import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
// import { InjectQueue } from '@nestjs/bull';
// import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionResponseDto } from './dto/transactions.dto';
import { Currency } from '../common/enums/transaction.enum';
import { TransactionType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    // private notificationsService: NotificationsService,
    // @InjectQueue('smart-contract-queue') private smartContractQueue: Queue,
    // @InjectQueue('rateio-queue') private rateioQueue: Queue,
  ) {}

  async createTransaction(data: any): Promise<TransactionResponseDto> {
    this.logger.log('Iniciando criação de transação', { type: data.type, amount: data.amount, currency: data.currency });
    
    // Validar dados básicos
    this.logger.debug('Validando dados básicos da transação');
    this.validateTransactionData(data);
    this.logger.debug('Dados básicos validados com sucesso');

    // Resolver toPhone para toWalletId se fornecido
    if (data.toPhone && !data.toWalletId) {
      this.logger.debug('Resolvendo telefone para carteira padrão', { phone: data.toPhone });
      const resolvedWallet = await this.resolvePhoneToDefaultWallet(data.toPhone);
      data.toWalletId = resolvedWallet.id;
      data.toUserId = resolvedWallet.userId;
      this.logger.debug('Telefone resolvido para carteira', { walletNumber: resolvedWallet.walletNumber });
    }

    // Resolver toUserId a partir de toWalletId se ainda não foi definido
    if (data.toWalletId && !data.toUserId && data.type !== 'WITHDRAWAL') {
      this.logger.debug('Resolvendo toUserId a partir de toWalletId', { toWalletId: data.toWalletId });
      const toWallet = await this.prisma.wallet.findUnique({
        where: { id: data.toWalletId },
        select: { userId: true, walletNumber: true },
      });
      if (!toWallet) {
        throw new NotFoundException('Carteira de destino não encontrada');
      }
      data.toUserId = toWallet.userId;
      this.logger.debug('toUserId resolvido', { toUserId: data.toUserId, walletNumber: toWallet.walletNumber });
    }

    // Processar transação dentro de uma transação do banco
    this.logger.debug('Iniciando transação do banco de dados');
    const result = await this.prisma.$transaction(async (prisma) => {
      this.logger.debug('Dentro da transação do banco de dados');
      
      // 1. Validar carteiras e usuários baseado no tipo
      this.logger.debug('Validando carteiras', { type: data.type });
      let fromWallet = null;
      let toWallet = null;
      
      if (data.type === 'DEPOSIT') {
        // Para depósitos, só validamos a carteira de destino
        toWallet = await this.validateWallet(prisma, data.toWalletId, data.toUserId);
        this.logger.debug('Carteira de destino validada', { walletId: toWallet.id });
      } else if (data.type === 'WITHDRAWAL') {
        // Para saques, só validamos a carteira de origem
        fromWallet = await this.validateWallet(prisma, data.fromWalletId, data.fromUserId);
        this.logger.debug('Carteira de origem validada', { walletId: fromWallet.id });
      } else {
        // Para outros tipos, validamos ambas as carteiras
        fromWallet = await this.validateWallet(prisma, data.fromWalletId, data.fromUserId);
        this.logger.debug('Carteira de origem validada', { walletId: fromWallet.id });
        
        toWallet = await this.validateWallet(prisma, data.toWalletId, data.toUserId);
        this.logger.debug('Carteira de destino validada', { walletId: toWallet.id });
      }

      // 2. Validar PIN da carteira de origem
      if (fromWallet) {
        this.logger.debug('Validando PIN da carteira de origem');
        await this.validatePin(fromWallet, data.pin);
        this.logger.debug('PIN validado com sucesso');
      }

      // 3. Validar saldo suficiente na carteira de origem
      if (fromWallet && data.type !== 'DEPOSIT') {
        this.logger.debug('Verificando saldo da carteira', { walletId: fromWallet.id, amount: data.amount, currency: data.currency });
        await this.validateBalance(fromWallet, data.amount, data.currency);
        this.logger.debug('Saldo suficiente confirmado');
      }

      // 4. Gerar referência única
      this.logger.debug('Gerando referência única para transação');
      const reference = await this.generateReference();
      this.logger.debug('Referência gerada', { reference });

      // 5. Criar transação
      this.logger.debug('Criando registro da transação no banco');
      const transaction = await prisma.transaction.create({
        data: {
          reference,
          fromWalletId: fromWallet?.id || null,
          toWalletId: toWallet?.id || null,
          fromUserId: fromWallet?.userId || null,
          toUserId: toWallet?.userId || null,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          status: 'PROCESSING',
          metadata: data.metadata || {},
        },
      });
      this.logger.debug('Transação criada', { transactionId: transaction.id, reference });

      try {
        // 6. Processar movimentação dos saldos
        this.logger.debug('Processando movimentação de saldos', { type: data.type });
        
        if (data.type === 'DEPOSIT') {
          // Apenas adicionar saldo à carteira de destino
          await this.updateWalletBalance(prisma, toWallet, data.amount, data.currency, 'ADD');
          this.logger.debug('Depósito processado', { walletId: toWallet.id });
        } else if (data.type === 'WITHDRAWAL') {
          // Apenas remover saldo da carteira de origem
          await this.updateWalletBalance(prisma, fromWallet, data.amount, data.currency, 'SUBTRACT');
          this.logger.debug('Saque processado', { walletId: fromWallet.id });
        } else {
          // Remover da origem e adicionar ao destino - PARALELIZADO para melhor performance
          await Promise.all([
            this.updateWalletBalance(prisma, fromWallet, data.amount, data.currency, 'SUBTRACT'),
            this.updateWalletBalance(prisma, toWallet, data.amount, data.currency, 'ADD'),
          ]);
          this.logger.debug('Transferência processada', { fromWalletId: fromWallet.id, toWalletId: toWallet.id });
        }

        // 7. Atualizar status para COMPLETED
        this.logger.debug('Finalizando transação', { transactionId: transaction.id });
        const updatedTransaction = await prisma.transaction.update({
          where: { id: transaction.id },
          data: { 
            status: 'COMPLETED',
            processedAt: new Date(),
            completedAt: new Date(),
          },
        });
        this.logger.debug('Transação finalizada com sucesso', { transactionId: updatedTransaction.id });

        return updatedTransaction;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error('Erro ao processar movimentação de saldos', errorStack, { transactionId: transaction.id, error: errorMessage });
        
        // Marcar transação como falhada
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        
        throw error;
      }
    });

    this.logger.log('Transação concluída com sucesso', { transactionId: result.id, type: result.type, amount: result.amount });
    return this.formatTransactionResponse(result);
  }

  private validateTransactionData(data: any): void {
    this.logger.debug('Validando amount', { amount: data.amount });
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException('Valor da transação deve ser maior que zero');
    }

    this.logger.debug('Validando currency', { currency: data.currency });
    if (!data.currency || !Object.values(Currency).includes(data.currency)) {
      throw new BadRequestException('Moeda inválida');
    }

    this.logger.debug('Validando type', { type: data.type });
    if (!data.type || !Object.values(TransactionType).includes(data.type)) {
      throw new BadRequestException('Tipo de transação inválido');
    }

    this.logger.debug('Validando carteiras baseado no tipo', { 
      type: data.type, 
      fromWalletId: data.fromWalletId, 
      toWalletId: data.toWalletId,
      toPhone: data.toPhone 
    });
    
    // Validações específicas por tipo
    if (data.type === 'DEPOSIT') {
      if (!data.toWalletId && !data.toPhone) {
        throw new BadRequestException('Carteira de destino ou telefone do destinatário é obrigatório para depósitos');
      }
      if (data.toWalletId && data.toPhone) {
        throw new BadRequestException('Não é possível usar toWalletId e toPhone simultaneamente');
      }
      if (data.fromWalletId) {
        throw new BadRequestException('Depósitos não devem ter carteira de origem');
      }
      // Validar UUID da carteira de destino se fornecido
      if (data.toWalletId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.toWalletId)) {
        throw new BadRequestException('ID da carteira de destino deve ser um UUID válido');
      }
      // Validar formato do telefone se fornecido
      if (data.toPhone && !/^\+244\d{9}$/.test(data.toPhone)) {
        throw new BadRequestException('Número de telefone deve estar no formato +244XXXXXXXXX');
      }
    } else if (data.type === 'WITHDRAWAL') {
      if (!data.fromWalletId) {
        throw new BadRequestException('Carteira de origem é obrigatória para saques');
      }
      if (data.toWalletId || data.toPhone) {
        throw new BadRequestException('Saques não devem ter carteira ou telefone de destino');
      }
      // Validar UUID da carteira de origem
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.fromWalletId)) {
        throw new BadRequestException('ID da carteira de origem deve ser um UUID válido');
      }
    } else {
      // Para TRANSFER, PAYMENT, etc.
      if (!data.fromWalletId) {
        throw new BadRequestException('Carteira de origem é obrigatória');
      }
      if (!data.toWalletId && !data.toPhone) {
        throw new BadRequestException('Carteira de destino ou telefone do destinatário é obrigatório');
      }
      if (data.toWalletId && data.toPhone) {
        throw new BadRequestException('Não é possível usar toWalletId e toPhone simultaneamente');
      }
      
      // Validar UUIDs se fornecidos
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.fromWalletId)) {
        throw new BadRequestException('ID da carteira de origem deve ser um UUID válido');
      }
      if (data.toWalletId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.toWalletId)) {
        throw new BadRequestException('ID da carteira de destino deve ser um UUID válido');
      }
      
      // Validar formato do telefone se fornecido
      if (data.toPhone && !/^\+244\d{9}$/.test(data.toPhone)) {
        throw new BadRequestException('Número de telefone deve estar no formato +244XXXXXXXXX');
      }
      
      // Não permitir transferência para si mesmo
      if (data.toWalletId && data.fromWalletId === data.toWalletId) {
        throw new BadRequestException('Não é possível transferir para a mesma carteira');
      }
    }

    this.logger.debug('Validando usuários', { fromUserId: data.fromUserId, toUserId: data.toUserId });
    // Para DEPOSIT e WITHDRAWAL, apenas um usuário é necessário
    if (data.type === 'DEPOSIT') {
      if (!data.toUserId) {
        throw new BadRequestException('Usuário de destino é obrigatório para depósitos');
      }
    } else if (data.type === 'WITHDRAWAL') {
      if (!data.fromUserId) {
        throw new BadRequestException('Usuário de origem é obrigatório para saques');
      }
    } else {
      // Para outros tipos, ambos os usuários são obrigatórios
      // Mas se toPhone está presente, toUserId será resolvido depois
      if (!data.fromUserId) {
        throw new BadRequestException('Usuário de origem é obrigatório');
      }
      if (!data.toUserId && !data.toPhone) {
        throw new BadRequestException('Usuário de destino ou telefone do destinatário é obrigatório');
      }
    }
  }

  private async validateWallet(prisma: any, walletId: string, userId: string) {
    this.logger.debug('Buscando carteira', { walletId, userId });
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId: userId,
        status: 'ACTIVE',
      },
    });

    if (!wallet) {
      this.logger.warn('Carteira não encontrada', { walletId, userId });
      throw new NotFoundException('Carteira não encontrada ou não pertence ao usuário');
    }

    this.logger.debug('Carteira encontrada', { id: wallet.id, status: wallet.status });
    return wallet;
  }

  private async generateReference(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TXN${timestamp}${random}`;
  }

  /**
   * Resolve um número de telefone para a carteira padrão do usuário
   */
  private async resolvePhoneToDefaultWallet(phone: string) {
    this.logger.debug('Resolvendo telefone para carteira padrão', { phone });
    
    // Buscar usuário pelo telefone
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, firstName: true, lastName: true, status: true }
    });

    if (!user) {
      this.logger.warn('Usuário não encontrado pelo telefone', { phone });
      throw new NotFoundException(`Usuário com telefone ${phone} não encontrado`);
    }

    if (user.status !== 'ACTIVE') {
      this.logger.warn('Usuário não está ativo', { phone, status: user.status });
      throw new BadRequestException(`Usuário com telefone ${phone} não está ativo`);
    }

    // Buscar carteira padrão do usuário
    const defaultWallet = await this.prisma.wallet.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        userId: true,
        walletNumber: true,
        status: true
      }
    });

    if (!defaultWallet) {
      this.logger.warn('Carteira padrão não encontrada para usuário', { userId: user.id, phone });
      throw new NotFoundException(`Usuário ${user.firstName} ${user.lastName} não possui carteira padrão ativa`);
    }

    this.logger.debug('Carteira padrão encontrada', { walletNumber: defaultWallet.walletNumber, userId: user.id });
    return defaultWallet;
  }

  private async validatePin(wallet: any, pin: string): Promise<void> {
    const security = wallet.security as any;
    const storedPin = security?.pin;
    
    if (!storedPin) {
      throw new BadRequestException('PIN não configurado para esta carteira');
    }
    
    // Se o PIN estiver hasheado (bcrypt), validar usando bcryptjs
    if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$')) {
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(pin, storedPin);
      if (!isValid) {
        throw new BadRequestException('PIN incorreto');
      }
    } else {
      // PIN em texto plano (compatibilidade)
      if (storedPin !== pin) {
        throw new BadRequestException('PIN incorreto');
      }
    }
  }

  private async validateBalance(wallet: any, amount: number, currency: Currency): Promise<void> {
    const currentBalance = (wallet.balances as any)[currency] || 0;
    if (currentBalance < amount) {
      throw new BadRequestException(`Saldo insuficiente para a transação. Saldo atual: ${currentBalance} ${currency}`);
    }
  }

  private async updateWalletBalance(prisma: any, wallet: any, amount: number, currency: Currency, operation: 'ADD' | 'SUBTRACT'): Promise<void> {
    const balances = wallet.balances as any;
    if (operation === 'ADD') {
      balances[currency] = (balances[currency] || 0) + amount;
    } else {
      balances[currency] = (balances[currency] || 0) - amount;
    }
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balances: balances },
    });
  }

  private formatTransactionResponse(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
      reference: transaction.reference,
      fromWalletId: transaction.fromWalletId,
      toWalletId: transaction.toWalletId,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      type: transaction.type,
      status: transaction.status,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      metadata: transaction.metadata,
    };
  }

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

    return transactions.map(t => this.formatTransactionResponse(t));
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

  async confirmSmartContractCondition(transactionId: string, userId: string): Promise<TransactionResponseDto> {
    const result = await this.prisma.$transaction(async (prisma) => {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
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

      // Verificar se o usuário pode confirmar
      const conditions = transaction.metadata as any;
      if (conditions?.details?.confirmUserId !== userId) {
        throw new BadRequestException('Usuário não autorizado a confirmar esta condição');
      }

      // Atualizar transação
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return updatedTransaction;
    });

    return this.formatTransactionResponse(result);
  }
} 