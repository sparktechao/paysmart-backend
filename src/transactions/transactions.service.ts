import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionResponseDto } from './dto/transactions.dto';
import { TransactionType, TransactionStatus, Currency } from '../common/enums/transaction.enum';
import { TransactionFactory } from './factories/transaction.factory';
import { TransactionValidator } from './validators/transaction.validator';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(data: any): Promise<TransactionResponseDto> {
    console.log('🚀 [1] Iniciando criação de transação:', data);

    try {
      // Validar dados de entrada com verificações de banco de dados
      await TransactionValidator.validateTransactionWithDatabase(this.prisma, data);

      // Gerar referência única
      const reference = TransactionFactory.generateReference();

      // Criar dados da transação usando factory
      const transactionData = TransactionFactory.createTransactionData(
        data.type,
        data,
        reference
      );

      console.log('📝 [2] Dados da transação criados:', transactionData);

      // Executar transação no banco de dados
      const result = await this.prisma.$transaction(async (prisma) => {
        // Buscar carteira de destino para atualização de saldo
        let toWallet = null;
        if (transactionData.toWalletId) {
          toWallet = await prisma.wallet.findUnique({
            where: { id: transactionData.toWalletId },
            include: { user: true }
          });
        }

        // Buscar carteira de origem para atualização de saldo
        let fromWallet = null;
        if (transactionData.fromWalletId) {
          fromWallet = await prisma.wallet.findUnique({
            where: { id: transactionData.fromWalletId },
          });
        }

        // Criar transação
        const createdTransaction = await prisma.transaction.create({
          data: {
            reference: transactionData.reference,
            type: transactionData.type as any,
            amount: transactionData.amount,
            currency: transactionData.currency as any,
            description: transactionData.description,
            status: 'PROCESSING' as any,
            fromWalletId: transactionData.fromWalletId,
            toWalletId: transactionData.toWalletId,
            fromUserId: transactionData.fromUserId,
            toUserId: transactionData.toUserId,
            metadata: transactionData.metadata,
          },
          include: {
            fromWallet: true,
            toWallet: true,
            fromUser: true,
            toUser: true,
          },
        });

        console.log('✅ [3] Transação criada:', createdTransaction.id);

        // Atualizar saldo da carteira de destino
        if (transactionData.toWalletId && toWallet) {
          const currentBalance = (toWallet.balances as any)[transactionData.currency] || 0;
          const newBalance = currentBalance + transactionData.amount;

          await prisma.wallet.update({
            where: { id: transactionData.toWalletId },
            data: {
              balances: {
                ...(toWallet.balances as any),
                [transactionData.currency]: newBalance,
              },
            },
          });

          console.log('💰 [4] Saldo atualizado:', {
            walletId: transactionData.toWalletId,
            currency: transactionData.currency,
            oldBalance: currentBalance,
            newBalance: newBalance,
          });
        }

        // Atualizar saldo da carteira de origem (se existir)
        if (transactionData.fromWalletId && fromWallet) {
          const currentBalance = (fromWallet.balances as any)[transactionData.currency] || 0;

          if (currentBalance < transactionData.amount) {
            throw new BadRequestException('Saldo insuficiente na carteira de origem');
          }

          const newBalance = currentBalance - transactionData.amount;

          await prisma.wallet.update({
            where: { id: transactionData.fromWalletId },
            data: {
              balances: {
                ...(fromWallet.balances as any),
                [transactionData.currency]: newBalance,
              },
            },
          });

          console.log('💰 [5] Saldo da carteira de origem atualizado:', {
            walletId: transactionData.fromWalletId,
            currency: transactionData.currency,
            oldBalance: currentBalance,
            newBalance: newBalance,
          });
        }

        // Marcar transação como concluída
        const completedTransaction = await prisma.transaction.update({
          where: { id: createdTransaction.id },
          data: { status: 'COMPLETED' as any },
          include: {
            fromWallet: true,
            toWallet: true,
            fromUser: true,
            toUser: true,
          },
        });

        console.log('✅ [6] Transação concluída:', completedTransaction.id);

        return completedTransaction;
      });

      // Retornar resposta formatada
      return {
        id: result.id,
        fromWalletId: result.fromWalletId || '',
        toWalletId: result.toWalletId || '',
        amount: result.amount,
        currency: result.currency as Currency,
        description: result.description,
        type: result.type as TransactionType,
        status: result.status as TransactionStatus,
        reference: result.reference,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        metadata: result.metadata as Record<string, any>,
      };

    } catch (error) {
      console.error('❌ Erro na criação da transação:', error);
      throw error;
    }
  }

  // TODO: Implementar validação de limites de carteira
  // TODO: Implementar notificações de transação
  // TODO: Implementar endpoints específicos para /deposits, /withdrawals, /transfers

  async getTransactionHistory(userId: string, filters?: any): Promise<TransactionResponseDto[]> {
    const where: any = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.currency) where.currency = filters.currency;
    if (filters?.startDate) where.createdAt = { gte: new Date(filters.startDate) };
    if (filters?.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filters.endDate) };

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    return transactions.map(t => ({
      id: t.id,
      fromWalletId: t.fromWalletId || '',
      toWalletId: t.toWalletId || '',
      amount: t.amount,
      currency: t.currency as Currency,
      description: t.description,
      type: t.type as TransactionType,
      status: t.status as TransactionStatus,
      reference: t.reference,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      metadata: t.metadata as Record<string, any>,
    }));
  }

  async getTransactionStats(userId: string): Promise<any> {
    const stats = await this.prisma.transaction.groupBy({
      by: ['status', 'type'],
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    return {
      totalTransactions: stats.reduce((acc, s) => acc + s._count.id, 0),
      totalAmount: stats.reduce((acc, s) => acc + (s._sum.amount || 0), 0),
      byStatus: stats.reduce((acc, s) => {
        acc[s.status] = { count: s._count.id, amount: s._sum.amount || 0 };
        return acc;
      }, {}),
      byType: stats.reduce((acc, s) => {
        acc[s.type] = { count: s._count.id, amount: s._sum.amount || 0 };
        return acc;
      }, {}),
    };
  }

  async confirmSmartContractCondition(id: string, _userId: string): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        fromWallet: true,
        toWallet: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.type !== 'SMART_CONTRACT') {
      throw new BadRequestException('Transação não é um smart contract');
    }

    if (transaction.status !== 'PENDING') {
      throw new BadRequestException('Smart contract já foi processado');
    }

    // TODO: Implementar lógica de confirmação de smart contract
    throw new BadRequestException('Funcionalidade de smart contract ainda não implementada');
  }
} 