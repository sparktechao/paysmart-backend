import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// import { InjectQueue } from '@nestjs/bull';
// import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
// import { NotificationsService } from '../notifications/notifications.service';
import { TransactionResponseDto } from './dto/transactions.dto';
import { TransactionType, TransactionStatus, Currency } from './dto/transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    // private notificationsService: NotificationsService,
    // @InjectQueue('smart-contract-queue') private smartContractQueue: Queue,
    // @InjectQueue('rateio-queue') private rateioQueue: Queue,
  ) {}

  async createTransaction(data: any): Promise<TransactionResponseDto> {
    console.log('🚀 [1] Iniciando criação de transação:', data);
    
    // Validar dados básicos
    console.log('🔍 [2] Validando dados básicos...');
    this.validateTransactionData(data);
    console.log('✅ [2] Dados básicos validados com sucesso');

    // Processar transação dentro de uma transação do banco
    console.log('🔄 [3] Iniciando transação do banco...');
    const result = await this.prisma.$transaction(async (prisma) => {
      console.log('📊 [4] Dentro da transação do banco');
      
      // 1. Validar carteiras e usuários baseado no tipo
      console.log('🏦 [5] Validando carteiras...');
      let fromWallet = null;
      let toWallet = null;
      
      if (data.type === 'DEPOSIT') {
        // Para depósitos, só validamos a carteira de destino
        toWallet = await this.validateWallet(prisma, data.toWalletId, data.toUserId);
        console.log('✅ [5] Carteira de destino validada:', toWallet.id);
      } else if (data.type === 'WITHDRAWAL') {
        // Para saques, só validamos a carteira de origem
        fromWallet = await this.validateWallet(prisma, data.fromWalletId, data.fromUserId);
        console.log('✅ [5] Carteira de origem validada:', fromWallet.id);
      } else {
        // Para outros tipos, validamos ambas as carteiras
        fromWallet = await this.validateWallet(prisma, data.fromWalletId, data.fromUserId);
        console.log('✅ [5] Carteira de origem validada:', fromWallet.id);
        
        toWallet = await this.validateWallet(prisma, data.toWalletId, data.toUserId);
        console.log('✅ [5] Carteira de destino validada:', toWallet.id);
      }

      // 2. Validar regras de negócio
      console.log('📋 [6] Validando regras de negócio...');
      await this.validateBusinessRules(data, fromWallet, toWallet);
      console.log('✅ [6] Regras de negócio validadas');

      // 3. Criar a transação
      console.log('📝 [7] Criando transação no banco...');
      
      // Preparar dados da transação baseado no tipo
      const transactionData: any = {
        reference: this.generateReference(),
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        status: this.getInitialStatus(data.type),
      };

      // Adicionar campos opcionais apenas se existirem
      if (data.fromWalletId) {
        transactionData.fromWallet = { connect: { id: data.fromWalletId } };
      }
      if (data.toWalletId) {
        transactionData.toWallet = { connect: { id: data.toWalletId } };
      }
      if (data.fromUserId && data.type !== 'DEPOSIT') {
        transactionData.fromUser = { connect: { id: data.fromUserId } };
      }
      // Para DEPOSIT, não incluímos fromUser nem fromWallet
      if (data.toUserId) {
        transactionData.toUser = { connect: { id: data.toUserId } };
      }
      if (data.notes) transactionData.notes = data.notes;
      if (data.conditions) transactionData.conditions = data.conditions;
      if (data.recipients) transactionData.recipients = data.recipients;
      if (data.scheduleDate) transactionData.scheduleDate = data.scheduleDate;

      // Criar transação usando Prisma normal
      const createdTransaction = await prisma.transaction.create({
        data: transactionData,
      });
      console.log('✅ [7] Transação criada:', createdTransaction.id);

      // 4. Processar transação baseada no tipo
      console.log('⚙️ [8] Processando transação por tipo...');
      const processedTransaction = await this.processTransactionByType(prisma, createdTransaction, data);
      console.log('✅ [8] Transação processada, status:', processedTransaction.status);

      // 5. Atualizar saldos das carteiras
      console.log('💰 [9] Atualizando saldos das carteiras...');
      await this.updateWalletBalances(prisma, processedTransaction, fromWallet, toWallet);
      console.log('✅ [9] Saldos atualizados com sucesso');

      console.log('🎉 [10] Transação do banco concluída com sucesso');
      return processedTransaction;
    }, {
      timeout: 30000 // 30 segundos de timeout
    });

    // 6. Notificar usuários (fora da transação para não causar timeout)
    // try {
    //   await this.notifyUsers(result);
    // } catch (error) {
    //   console.log('Erro ao enviar notificações (não crítico):', error.message);
    //   // Não falha a transação por erro de notificação
    // }

    // 7. Agendar processamentos especiais se necessário (comentado temporariamente)
    // await this.scheduleSpecialProcessing(result, data);

    return this.mapToResponseDto(result);
  }

  private validateTransactionData(data: any): void {
    console.log('🔍 [2.1] Validando amount:', data.amount);
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException('Valor da transação deve ser maior que zero');
    }

    console.log('🔍 [2.2] Validando currency:', data.currency);
    if (!data.currency || !Object.values(Currency).includes(data.currency)) {
      throw new BadRequestException('Moeda inválida');
    }

    console.log('🔍 [2.3] Validando type:', data.type);
    if (!data.type || !Object.values(TransactionType).includes(data.type)) {
      throw new BadRequestException('Tipo de transação inválido');
    }

    console.log('🔍 [2.4] Validando carteiras baseado no tipo:', { type: data.type, fromWalletId: data.fromWalletId, toWalletId: data.toWalletId });
    
    // Validações específicas por tipo
    if (data.type === 'DEPOSIT') {
      if (!data.toWalletId) {
        throw new BadRequestException('Carteira de destino é obrigatória para depósitos');
      }
      if (data.fromWalletId) {
        throw new BadRequestException('Depósitos não devem ter carteira de origem');
      }
      // Validar UUID da carteira de destino
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.toWalletId)) {
        throw new BadRequestException('ID da carteira de destino deve ser um UUID válido');
      }
    } else if (data.type === 'WITHDRAWAL') {
      if (!data.fromWalletId) {
        throw new BadRequestException('Carteira de origem é obrigatória para saques');
      }
      if (data.toWalletId) {
        throw new BadRequestException('Saques não devem ter carteira de destino');
      }
      // Validar UUID da carteira de origem
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.fromWalletId)) {
        throw new BadRequestException('ID da carteira de origem deve ser um UUID válido');
      }
    } else {
      // Para outros tipos (TRANSFER, etc.)
      if (!data.fromWalletId || !data.toWalletId) {
        throw new BadRequestException('Carteiras de origem e destino são obrigatórias');
      }
      // Validar UUIDs
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.fromWalletId)) {
        throw new BadRequestException('ID da carteira de origem deve ser um UUID válido');
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.toWalletId)) {
        throw new BadRequestException('ID da carteira de destino deve ser um UUID válido');
      }
    }

    console.log('🔍 [2.5] Validando usuários:', { fromUserId: data.fromUserId, toUserId: data.toUserId });
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
      if (!data.fromUserId || !data.toUserId) {
        throw new BadRequestException('Usuários de origem e destino são obrigatórios');
      }
    }
  }

  private async validateWallet(prisma: any, walletId: string, userId: string) {
    console.log('🏦 [5.1] Buscando carteira:', { walletId, userId });
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId: userId,
        status: 'ACTIVE',
      },
    });

    if (!wallet) {
      console.log('❌ [5.1] Carteira não encontrada');
      throw new NotFoundException('Carteira não encontrada ou não pertence ao usuário');
    }

    console.log('✅ [5.1] Carteira encontrada:', { id: wallet.id, status: wallet.status });
    return wallet;
  }

  private async validateBusinessRules(data: any, fromWallet: any, toWallet: any): Promise<void> {
    // Usar toWallet para evitar erro de TypeScript
    if (toWallet) {
      // Validações específicas para carteira de destino podem ser adicionadas aqui
    }
    console.log('📋 [6.1] Validando regras de negócio:', {
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      fromWalletId: data.fromWalletId,
      toWalletId: data.toWalletId,
      fromWalletBalances: fromWallet?.balances,
      debitsFromWallet: this.debitsFromWallet(data.type)
    });

    // 1. Validar se não é a mesma carteira (apenas para TRANSFER)
    if (data.type === 'TRANSFER') {
      console.log('📋 [6.2] Verificando se não é a mesma carteira...');
      if (data.fromWalletId === data.toWalletId) {
        console.log('❌ [6.2] Mesma carteira detectada');
        throw new BadRequestException('Não é possível fazer transações para a mesma carteira');
      }
      console.log('✅ [6.2] Carteiras diferentes - OK');
    }

    // 2. Validar saldo suficiente para transações que debitam
    console.log('📋 [6.3] Verificando se transação debita da carteira...');
    if (this.debitsFromWallet(data.type) && fromWallet) {
      const currentBalance = (fromWallet.balances as any)[data.currency] || 0;
      console.log('📋 [6.3] Verificando saldo:', { currentBalance, requiredAmount: data.amount });
      if (currentBalance < data.amount) {
        console.log('❌ [6.3] Saldo insuficiente');
        throw new BadRequestException(`Saldo insuficiente. Saldo atual: ${currentBalance} ${data.currency}`);
      }
      console.log('✅ [6.3] Saldo suficiente - OK');
    } else {
      console.log('✅ [6.3] Transação não debita da carteira - OK');
    }

    // 3. Validar limites da carteira (apenas para transações que debitam)
    // TODO: Implementar validação de limites
    /*
    if (fromWallet && this.debitsFromWallet(data.type)) {
      const limits = fromWallet.limits as any;
      if (limits) {
        // Limite diário
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyTransactions = await this.prisma.transaction.aggregate({
          where: {
            fromWalletId: data.fromWalletId,
            createdAt: { gte: today },
            status: { in: ['COMPLETED', 'PROCESSING'] },
          },
          _sum: { amount: true },
        });

        const dailyTotal = (dailyTransactions._sum.amount || 0) + data.amount;
        if (dailyTotal > limits.dailyTransfer) {
          throw new BadRequestException(`Limite diário excedido. Limite: ${limits.dailyTransfer} ${data.currency}`);
        }

        // Limite mensal
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthlyTransactions = await this.prisma.transaction.aggregate({
          where: {
            fromWalletId: data.fromWalletId,
            createdAt: { gte: monthStart },
            status: { in: ['COMPLETED', 'PROCESSING'] },
          },
          _sum: { amount: true },
        });

        const monthlyTotal = (monthlyTransactions._sum.amount || 0) + data.amount;
        if (monthlyTotal > limits.monthlyTransfer) {
          throw new BadRequestException(`Limite mensal excedido. Limite: ${limits.monthlyTransfer} ${data.currency}`);
        }
      }
    }

    // 4. Validar se carteira de destino não excederá limite máximo
    if (toWallet && toWallet.limits) {
      const toWalletLimits = toWallet.limits as any;
      const toWalletBalance = (toWallet.balances as any)[data.currency] || 0;
      if (toWalletBalance + data.amount > toWalletLimits.maxBalance) {
        throw new BadRequestException(`Carteira de destino excederá o limite máximo de saldo`);
      }
    }
    */
  }

  private debitsFromWallet(type: TransactionType): boolean {
    // Tipos que debitam da carteira de origem
    return ['TRANSFER', 'WITHDRAWAL', 'PAYMENT_REQUEST', 'SERVICE_PAYMENT', 'SHARED_WALLET', 'BUSINESS_TRANSFER', 'INTERNATIONAL_TRANSFER', 'FEE'].includes(type);
  }

  private getInitialStatus(type: TransactionType): TransactionStatus {
    // Smart contracts e rateios começam como PENDING
    if (type === 'SMART_CONTRACT' || type === 'RATEIO') {
      return 'PENDING' as TransactionStatus;
    }
    
    // DEPOSIT e WITHDRAWAL são processados imediatamente
    if (type === 'DEPOSIT' || type === 'WITHDRAWAL') {
      return 'PROCESSING' as TransactionStatus;
    }
    
    // Outras transações são processadas imediatamente
    return 'PROCESSING' as TransactionStatus;
  }

  private async processTransactionByType(prisma: any, transaction: any, data: any): Promise<any> {
    switch (transaction.type) {
      case 'SMART_CONTRACT':
        return this.processSmartContract(prisma, transaction, data);
      
      case 'RATEIO':
        return this.processRateio(prisma, transaction, data);
      
      case 'DEPOSIT':
      case 'WITHDRAWAL':
      default:
        // Transações simples são processadas imediatamente
        return prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
    }
  }

  private async processSmartContract(prisma: any, transaction: any, data: any): Promise<any> {
    // Smart contracts ficam pendentes até confirmação
    return prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'PENDING',
        conditions: data.conditions,
      },
    });
  }

  private async processRateio(prisma: any, transaction: any, data: any): Promise<any> {
    // Rateios ficam pendentes até confirmação dos participantes
    return prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'PENDING',
        recipients: data.recipients,
      },
    });
  }

  private async updateWalletBalances(prisma: any, transaction: any, fromWallet: any, toWallet: any): Promise<void> {
    console.log('💰 [9.1] Verificando status da transação:', transaction.status);
    if (transaction.status !== 'COMPLETED') {
      console.log('💰 [9.1] Transação não está completada, pulando atualização de saldos');
      return; // Só atualiza saldos para transações completadas
    }

    const amount = transaction.amount;
    const currency = transaction.currency;
    console.log('💰 [9.2] Atualizando saldos:', { amount, currency, type: transaction.type });

    // Atualizar carteira de origem (debitar) - para WITHDRAWAL e TRANSFER
    if (this.debitsFromWallet(transaction.type) && fromWallet) {
      console.log('💰 [9.3] Debitando da carteira de origem...');
      const fromBalances = fromWallet.balances as any;
      const oldBalance = fromBalances[currency] || 0;
      fromBalances[currency] = oldBalance - amount;
      console.log('💰 [9.3] Debitando da carteira de origem:', { oldBalance, newBalance: fromBalances[currency] });

      await prisma.wallet.update({
        where: { id: fromWallet.id },
        data: { balances: fromBalances },
      });
      console.log('💰 [9.3] Carteira de origem atualizada');
    } else {
      console.log('💰 [9.3] Transação não debita da carteira de origem');
    }

    // Atualizar carteira de destino (creditar) - para DEPOSIT e TRANSFER
    if (toWallet) {
      console.log('💰 [9.4] Creditando na carteira de destino...');
      const toBalances = toWallet.balances as any;
      const oldBalance = toBalances[currency] || 0;
      toBalances[currency] = oldBalance + amount;
      console.log('💰 [9.4] Creditando na carteira de destino:', { oldBalance, newBalance: toBalances[currency] });

      await prisma.wallet.update({
        where: { id: toWallet.id },
        data: { balances: toBalances },
      });
      console.log('💰 [9.4] Carteira de destino atualizada');
    } else {
      console.log('💰 [9.4] Transação não credita na carteira de destino');
    }
  }

  // private async notifyUsers(transaction: any): Promise<void> {
  //   try {
  //     // Notificar usuário de origem
  //     await this.notificationsService.createNotification({
  //       userId: transaction.fromUserId,
  //       type: 'PAYMENT_SENT',
  //       title: 'Transação Concluída',
  //       message: `Transação de ${transaction.amount} ${transaction.currency} foi concluída com sucesso.`,
  //       data: { transactionId: transaction.id },
  //     });

  //     // Notificar usuário de destino (se diferente)
  //     if (transaction.fromUserId !== transaction.toUserId) {
  //       await this.notificationsService.createNotification({
  //         userId: transaction.toUserId,
  //         type: 'PAYMENT_RECEIVED',
  //         title: 'Dinheiro Recebido',
  //         message: `Você recebeu ${transaction.amount} ${transaction.currency}.`,
  //         data: { transactionId: transaction.id },
  //       });
  //     }
  //   } catch (error) {
  //     // Log do erro mas não falha a transação
  //     console.error('Erro ao enviar notificações:', error);
  //   }
  // }

  // private async scheduleSpecialProcessing(transaction: any, data: any): Promise<void> {
  //   // Agendar processamento de smart contracts
  //   if (transaction.type === 'SMART_CONTRACT' && data.conditions) {
  //     await this.smartContractQueue.add(
  //       'process-smart-contract',
  //       { transactionId: transaction.id, conditions: data.conditions },
  //       { delay: this.getTimeoutDelay(data.conditions) }
  //     );
  //   }

  //   // Agendar processamento de rateios
  //   if (transaction.type === 'RATEIO' && data.recipients) {
  //     const delay = data.scheduleDate 
  //       ? new Date(data.scheduleDate).getTime() - Date.now()
  //       : 0;
  //     
  //     await this.rateioQueue.add(
  //       'process-rateio',
  //       { transactionId: transaction.id, recipients: data.recipients },
  //       { delay: Math.max(0, delay) }
  //     );
  //   }
  // }

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
    const conditions = transaction.conditions as any;
    if (conditions?.details?.confirmUserId !== userId) {
      throw new BadRequestException('Usuário não autorizado a confirmar esta condição');
    }

    // Atualizar transação
      const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        conditionMet: true,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

      // Atualizar saldos
      await this.updateWalletBalances(prisma, updatedTransaction, transaction.fromWallet, transaction.toWallet);

      // Notificar usuários (comentado temporariamente)
      // await this.notifyUsers(updatedTransaction);

      return updatedTransaction;
    });

    return this.mapToResponseDto(result);
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

    return transactions.map(t => this.mapToResponseDto(t));
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

  private generateReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TXN${timestamp}${random}`;
  }

  // private getTimeoutDelay(conditions: any): number {
  //   if (conditions?.details?.timeout) {
  //     const timeout = conditions.details.timeout;
  //     if (timeout.includes('days')) {
  //       const days = parseInt(timeout);
  //       return days * 24 * 60 * 60 * 1000;
  //     }
  //     if (timeout.includes('hours')) {
  //       const hours = parseInt(timeout);
  //       return hours * 60 * 60 * 1000;
  //     }
  //   }
  //   return 7 * 24 * 60 * 60 * 1000; // 7 dias padrão
  // }

  private mapToResponseDto(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
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
} 