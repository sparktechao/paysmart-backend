import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { SmartContractResponseDto } from './dto/smart-contracts.dto';

@Injectable()
export class SmartContractsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
    @InjectQueue('smart-contract-queue') private smartContractQueue: Queue,
  ) {}

  async createSmartContract(data: {
    fromUserId: string;
    fromWalletId: string;
    toUserId: string;
    toWalletId: string;
    amount: number;
    currency: string;
    description: string;
    conditions: {
      type: 'MANUAL_CONFIRM' | 'TIME_BASED' | 'MULTI_PARTY';
      details: {
        confirmUserId?: string;
        timeout?: string;
        requiredConfirmations?: number;
        confirmers?: string[];
      };
    };
    metadata?: any;
  }): Promise<SmartContractResponseDto> {
    // Validar condições
    this.validateSmartContractConditions(data.conditions);

    // Criar transação com smart contract
    const transaction = await this.transactionsService.createTransaction({
      fromWalletId: data.fromWalletId,
      toWalletId: data.toWalletId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      type: 'SMART_CONTRACT',
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      notes: `Smart Contract: ${data.conditions.type}`,
      conditions: data.conditions,
      metadata: data.metadata,
    });

    // Criar confirmações necessárias
    await this.createConfirmations(transaction.id, data.conditions);

    // Agendar verificação de timeout se aplicável
    if (data.conditions.type === 'TIME_BASED' && data.conditions.details.timeout) {
      const timeoutDelay = this.calculateTimeoutDelay(data.conditions.details.timeout);
      await this.smartContractQueue.add(
        'check-smart-contract-timeout',
        { transactionId: transaction.id },
        { delay: timeoutDelay }
      );
    }

    // Notificar participantes
    await this.notifySmartContractParticipants(transaction.id, data);

    const result = await this.getSmartContractDetails(transaction.id, data.fromUserId);
    return {
      ...result,
      confirmations: result.confirmations || [],
    };
  }

  async confirmCondition(
    transactionId: string,
    userId: string,
    confirmConditionDto: any
  ): Promise<SmartContractResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: 'SMART_CONTRACT',
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
    });

    if (!transaction) {
      throw new NotFoundException('Smart contract não encontrado');
    }

    // Verificar se o usuário pode confirmar
    if (!this.canUserConfirm(userId, transaction.conditions, [])) {
      throw new BadRequestException('Usuário não pode confirmar este smart contract');
    }

    // Verificar se já existe uma confirmação
    const existingConfirmation = await this.prisma.smartContractConfirmation.findFirst({
      where: {
        transactionId,
        userId,
      },
    });

    if (existingConfirmation) {
      // Atualizar confirmação existente
      await this.prisma.smartContractConfirmation.update({
        where: { id: existingConfirmation.id },
        data: {
          confirmed: true,
          notes: confirmConditionDto.notes,
        },
      });
    } else {
      // Criar nova confirmação
      await this.prisma.smartContractConfirmation.create({
        data: {
          transactionId,
          userId,
          confirmed: true,
          notes: confirmConditionDto.notes,
        },
      });
    }

    // Verificar se todas as condições foram atendidas
    const allConditionsMet = await this.checkAllConditionsMet(transactionId, transaction.conditions);
    
    if (allConditionsMet) {
      await this.executeSmartContract(transactionId);
    }

    // Notificar participantes
    await this.notifySmartContractParticipants(transactionId, {
      type: 'CONDITION_CONFIRMED',
      confirmedBy: userId,
      notes: confirmConditionDto.notes,
    });

    const result = await this.getSmartContractDetails(transaction.id, userId);
    return {
      ...result,
      confirmations: result.confirmations || [],
    };
  }

  async confirmSmartContract(
    transactionId: string,
    userId: string,
    notes?: string
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        smartContractConfirmations: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Smart contract não encontrado');
    }

    if (transaction.type !== 'SMART_CONTRACT') {
      throw new BadRequestException('Transação não é um smart contract');
    }

    const conditions = transaction.conditions as any;
    
    // Verificar se o usuário pode confirmar
    if (!this.canUserConfirm(userId, conditions, transaction.smartContractConfirmations)) {
      throw new BadRequestException('Usuário não autorizado a confirmar este smart contract');
    }

    // Criar ou atualizar confirmação
    const confirmation = await this.prisma.smartContractConfirmation.upsert({
      where: {
        id: `${transactionId}_${userId}`,
      },
      update: {
        confirmed: true,
        notes,
      },
      create: {
        transactionId,
        userId,
        confirmed: true,
        notes,
      },
    });

    // Verificar se todas as condições foram atendidas
    const allConditionsMet = await this.checkAllConditionsMet(transactionId, conditions);
    
    if (allConditionsMet) {
      await this.executeSmartContract(transactionId);
    }

    return {
      confirmation,
      allConditionsMet,
      message: allConditionsMet 
        ? 'Smart contract executado com sucesso' 
        : 'Confirmação registrada',
    };
  }

  async getSmartContractDetails(transactionId: string, userId: string): Promise<SmartContractResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: 'SMART_CONTRACT',
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      include: {
        smartContractConfirmations: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        fromUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        toUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Smart contract não encontrado');
    }

    return {
      id: transaction.id,
      fromWalletId: transaction.fromWalletId,
      toWalletId: transaction.toWalletId,
      fromUserId: transaction.fromUserId,
      toUserId: transaction.toUserId,
      amount: transaction.amount,
      description: transaction.description,
      type: transaction.type as any,
      status: transaction.status as any,
      conditions: transaction.conditions as any,
      confirmations: transaction.smartContractConfirmations.map(conf => ({
        id: conf.id,
        userId: conf.userId,
        userName: `${conf.user.firstName} ${conf.user.lastName}`,
        confirmed: conf.confirmed,
        notes: conf.notes,
        createdAt: conf.createdAt,
      })),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt,
      metadata: transaction.metadata as Record<string, any>,
    };
  }

  async getPendingSmartContracts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          type: 'SMART_CONTRACT',
          status: 'PENDING',
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
            {
              smartContractConfirmations: {
                some: {
                  userId,
                  confirmed: false,
                },
              },
            },
          ],
        },
        include: {
          smartContractConfirmations: {
            where: { userId, confirmed: false },
          },
          fromUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          toUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          type: 'SMART_CONTRACT',
          status: 'PENDING',
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
            {
              smartContractConfirmations: {
                some: {
                  userId,
                  confirmed: false,
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cancelSmartContract(transactionId: string, userId: string): Promise<SmartContractResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: 'SMART_CONTRACT',
        fromUserId: userId,
        status: 'PENDING',
      },
    });

    if (!transaction) {
      throw new NotFoundException('Smart contract não encontrado ou não pode ser cancelado');
    }

    // Cancelar transação
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Notificar destinatário
    await this.notificationsService.createNotification({
      userId: transaction.toUserId,
      type: 'PAYMENT_REQUEST',
      title: 'Smart Contract Cancelado',
      message: `O smart contract "${transaction.description}" foi cancelado`,
      data: {
        transactionId,
        cancelledBy: userId,
      },
    });

    const result = await this.getSmartContractDetails(transaction.id, userId);
    return {
      ...result,
      confirmations: [],
    };
  }

  async getUserSmartContracts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
        },
        include: {
          smartContractConfirmations: true,
          fromUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          toUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
        },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSmartContractById(id: string, userId: string): Promise<SmartContractResponseDto> {
    const result = await this.getSmartContractDetails(id, userId);
    return {
      ...result,
      confirmations: result.confirmations || [],
    };
  }

  async getPendingConfirmations(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [confirmations, total] = await Promise.all([
      this.prisma.smartContractConfirmation.findMany({
        where: {
          userId,
          confirmed: false,
        },
        include: {
          transaction: {
            include: {
              fromUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              toUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.smartContractConfirmation.count({
        where: {
          userId,
          confirmed: false,
        },
      }),
    ]);

    return {
      confirmations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSmartContractStats(userId: string) {
    const [
      totalContracts,
      activeContracts,
      completedContracts,
      cancelledContracts,
      totalAmount,
      averageAmount,
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
          status: 'PENDING',
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
          status: 'COMPLETED',
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
          status: 'CANCELLED',
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          type: 'SMART_CONTRACT',
          status: 'COMPLETED',
        },
        _avg: { amount: true },
      }),
    ]);

    return {
      totalContracts,
      activeContracts,
      completedContracts,
      cancelledContracts,
      totalAmount: totalAmount._sum.amount || 0,
      averageAmount: averageAmount._avg.amount || 0,
      completionRate: totalContracts > 0 ? (completedContracts / totalContracts) * 100 : 0,
    };
  }

  private validateSmartContractConditions(conditions: any) {
    if (!conditions.type) {
      throw new BadRequestException('Tipo de condição é obrigatório');
    }

    switch (conditions.type) {
      case 'MANUAL_CONFIRM':
        if (!conditions.details?.confirmUserId) {
          throw new BadRequestException('confirmUserId é obrigatório para MANUAL_CONFIRM');
        }
        break;
      
      case 'TIME_BASED':
        if (!conditions.details?.timeout) {
          throw new BadRequestException('timeout é obrigatório para TIME_BASED');
        }
        break;
      
      case 'MULTI_PARTY':
        if (!conditions.details?.requiredConfirmations || !conditions.details?.confirmers) {
          throw new BadRequestException('requiredConfirmations e confirmers são obrigatórios para MULTI_PARTY');
        }
        if (conditions.details.confirmers.length < conditions.details.requiredConfirmations) {
          throw new BadRequestException('Número de confirmadores deve ser maior ou igual ao número de confirmações requeridas');
        }
        break;
      
      default:
        throw new BadRequestException('Tipo de condição inválido');
    }
  }

  private async createConfirmations(transactionId: string, conditions: any) {
    const confirmations = [];

    switch (conditions.type) {
      case 'MANUAL_CONFIRM':
        confirmations.push(
          this.prisma.smartContractConfirmation.create({
            data: {
              transactionId,
              userId: conditions.details.confirmUserId,
              confirmed: false,
            },
          })
        );
        break;
      
      case 'MULTI_PARTY':
        for (const confirmerId of conditions.details.confirmers) {
          confirmations.push(
            this.prisma.smartContractConfirmation.create({
              data: {
                transactionId,
                userId: confirmerId,
                confirmed: false,
              },
            })
          );
        }
        break;
    }

    return Promise.all(confirmations);
  }

  private canUserConfirm(
    userId: string,
    conditions: any,
    _existingConfirmations: any[]
  ): boolean {
    switch (conditions.type) {
      case 'MANUAL_CONFIRM':
        return conditions.details.confirmUserId === userId;
      
      case 'MULTI_PARTY':
        return conditions.details.confirmers.includes(userId);
      
      default:
        return false;
    }
  }

  private async checkAllConditionsMet(transactionId: string, conditions: any): Promise<boolean> {
    const confirmations = await this.prisma.smartContractConfirmation.findMany({
      where: { transactionId },
    });

    switch (conditions.type) {
      case 'MANUAL_CONFIRM':
        return confirmations.some(c => c.confirmed);
      
      case 'MULTI_PARTY':
        const confirmedCount = confirmations.filter(c => c.confirmed).length;
        return confirmedCount >= conditions.details.requiredConfirmations;
      
      case 'TIME_BASED':
        // Para TIME_BASED, a condição é atendida automaticamente após o timeout
        return true;
      
      default:
        return false;
    }
  }

  private async executeSmartContract(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) return;

    // Atualizar status da transação
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        conditionMet: true,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Executar a transferência real
    await this.executeTransfer(transaction);

    // Notificar participantes
    await this.notificationsService.createNotification({
      userId: transaction.fromUserId,
      type: 'SMART_CONTRACT_UPDATE',
      title: 'Smart Contract Executado',
      message: `O smart contract "${transaction.description}" foi executado com sucesso`,
      data: { transactionId },
    });

    await this.notificationsService.createNotification({
      userId: transaction.toUserId,
      type: 'PAYMENT_RECEIVED',
      title: 'Smart Contract Executado',
      message: `Você recebeu ${transaction.amount} ${transaction.currency} do smart contract "${transaction.description}"`,
      data: { transactionId },
    });
  }

  private async executeTransfer(transaction: any) {
    // Aqui você implementaria a lógica real de transferência
    // Por enquanto, apenas atualizamos os saldos
    await this.updateWalletBalances(
      transaction.fromWalletId,
      transaction.toWalletId,
      transaction.amount,
      transaction.currency
    );
  }

  private async updateWalletBalances(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    currency: string
  ) {
    await this.prisma.$transaction(async (prisma) => {
      // Buscar carteiras atuais
      const fromWallet = await prisma.wallet.findUnique({
        where: { id: fromWalletId },
        select: { balances: true },
      });
      
      const toWallet = await prisma.wallet.findUnique({
        where: { id: toWalletId },
        select: { balances: true },
      });

      if (!fromWallet || !toWallet) {
        throw new Error('Carteira não encontrada');
      }

      // Calcular novos saldos
      const fromBalance = (fromWallet.balances as any)[currency] || 0;
      const toBalance = (toWallet.balances as any)[currency] || 0;

      const newFromBalance = fromBalance - amount;
      const newToBalance = toBalance + amount;

      // Atualizar carteiras
      await prisma.wallet.update({
        where: { id: fromWalletId },
        data: {
                      balances: {
              ...(fromWallet.balances as any),
              [currency]: newFromBalance,
            },
        },
      });

      await prisma.wallet.update({
        where: { id: toWalletId },
        data: {
                      balances: {
              ...(toWallet.balances as any),
              [currency]: newToBalance,
            },
        },
      });
    });
  }

  private calculateTimeoutDelay(timeout: string): number {
    const match = timeout.match(/(\d+)\s*(days?|hours?|minutes?)/i);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // 7 dias padrão
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'day':
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      case 'hour':
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'minute':
      case 'minutes':
        return value * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private async notifySmartContractParticipants(transactionId: string, data: any) {
    // Notificar criador
    await this.notificationsService.createNotification({
      userId: data.fromUserId,
      type: 'SMART_CONTRACT_UPDATE',
      title: 'Smart Contract Criado',
      message: `Smart contract "${data.description}" criado com sucesso`,
      data: { transactionId },
    });

    // Notificar destinatário
    await this.notificationsService.createNotification({
      userId: data.toUserId,
      type: 'PAYMENT_REQUEST',
      title: 'Smart Contract Recebido',
      message: `Você recebeu um smart contract de ${data.amount} ${data.currency}`,
      data: { transactionId },
    });

    // Notificar confirmadores se aplicável
    if (data.conditions.type === 'MANUAL_CONFIRM') {
      await this.notificationsService.createNotification({
        userId: data.conditions.details.confirmUserId,
        type: 'VALIDATION_REQUEST',
        title: 'Confirmação de Smart Contract',
        message: `Você precisa confirmar um smart contract`,
        data: { transactionId },
      });
    } else if (data.conditions.type === 'MULTI_PARTY') {
      for (const confirmerId of data.conditions.details.confirmers) {
        await this.notificationsService.createNotification({
          userId: confirmerId,
          type: 'VALIDATION_REQUEST',
          title: 'Confirmação de Smart Contract',
          message: `Você precisa confirmar um smart contract`,
          data: { transactionId },
        });
      }
    }
  }
}
