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

    // Resolver toPhone para toWalletId se fornecido
    if (data.toPhone && !data.toWalletId) {
      console.log('📱 [2.1] Resolvendo telefone para carteira padrão...');
      const resolvedWallet = await this.resolvePhoneToDefaultWallet(data.toPhone);
      data.toWalletId = resolvedWallet.id;
      data.toUserId = resolvedWallet.userId;
      console.log('✅ [2.1] Telefone resolvido para carteira:', resolvedWallet.walletNumber);
    }

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

      // 2. Validar PIN da carteira de origem
      if (fromWallet) {
        console.log('🔐 [6] Validando PIN...');
        await this.validatePin(fromWallet, data.pin);
        console.log('✅ [6] PIN validado com sucesso');
      }

      // 3. Validar saldo suficiente na carteira de origem
      if (fromWallet && data.type !== 'DEPOSIT') {
        console.log('💰 [7] Verificando saldo...');
        await this.validateBalance(fromWallet, data.amount, data.currency);
        console.log('✅ [7] Saldo suficiente confirmado');
      }

      // 4. Gerar referência única
      console.log('🔢 [8] Gerando referência...');
      const reference = await this.generateReference();
      console.log('✅ [8] Referência gerada:', reference);

      // 5. Criar transação
      console.log('💾 [9] Criando registro da transação...');
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
      console.log('✅ [9] Transação criada:', transaction.id);

      try {
        // 6. Processar movimentação dos saldos
        console.log('🔄 [10] Processando movimentação de saldos...');
        
        if (data.type === 'DEPOSIT') {
          // Apenas adicionar saldo à carteira de destino
          await this.updateWalletBalance(prisma, toWallet, data.amount, data.currency, 'ADD');
          console.log('✅ [10] Depósito processado');
        } else if (data.type === 'WITHDRAWAL') {
          // Apenas remover saldo da carteira de origem
          await this.updateWalletBalance(prisma, fromWallet, data.amount, data.currency, 'SUBTRACT');
          console.log('✅ [10] Saque processado');
        } else {
          // Remover da origem e adicionar ao destino
          await this.updateWalletBalance(prisma, fromWallet, data.amount, data.currency, 'SUBTRACT');
          await this.updateWalletBalance(prisma, toWallet, data.amount, data.currency, 'ADD');
          console.log('✅ [10] Transferência processada');
        }

        // 7. Atualizar status para COMPLETED
        console.log('🏁 [11] Finalizando transação...');
        const updatedTransaction = await prisma.transaction.update({
          where: { id: transaction.id },
          data: { 
            status: 'COMPLETED',
            processedAt: new Date(),
            completedAt: new Date(),
          },
        });
        console.log('✅ [11] Transação finalizada com sucesso');

        return updatedTransaction;

      } catch (error) {
        console.error('❌ [ERROR] Erro ao processar movimentação:', error);
        
        // Marcar transação como falhada
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        
        throw error;
      }
    });

    console.log('🎉 [12] Transação concluída com sucesso:', result.id);
    return this.formatTransactionResponse(result);
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

    console.log('🔍 [2.4] Validando carteiras baseado no tipo:', { 
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

  private async generateReference(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
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

  /**
   * Resolve um número de telefone para a carteira padrão do usuário
   */
  private async resolvePhoneToDefaultWallet(phone: string) {
    console.log('📱 Resolvendo telefone para carteira padrão:', phone);
    
    // Buscar usuário pelo telefone
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, firstName: true, lastName: true, status: true }
    });

    if (!user) {
      throw new NotFoundException(`Usuário com telefone ${phone} não encontrado`);
    }

    if (user.status !== 'ACTIVE') {
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
      throw new NotFoundException(`Usuário ${user.firstName} ${user.lastName} não possui carteira padrão ativa`);
    }

    console.log('✅ Carteira padrão encontrada:', defaultWallet.walletNumber);
    return defaultWallet;
  }

  private async validatePin(wallet: any, pin: string): Promise<void> {
    const security = wallet.security as any;
    const storedPin = security?.pin;
    
    if (!storedPin) {
      throw new BadRequestException('PIN não configurado para esta carteira');
    }
    
    // Se o PIN estiver hasheado (bcrypt), validar usando bcrypt
    if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$')) {
      const bcrypt = require('bcrypt');
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
} 