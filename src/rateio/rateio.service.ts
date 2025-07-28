import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NotificationType, TransactionType } from '@prisma/client';

@Injectable()
export class RateioService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
    @InjectQueue('rateio-queue') private rateioQueue: Queue,
  ) {}

  async createRateio(data: {
    fromUserId: string;
    fromWalletId: string;
    totalAmount: number;
    currency: string;
    description: string;
    recipients: Array<{
      walletId: string;
      userId: string;
      amount: number;
      percentage: number;
    }>;
    scheduleDate?: Date;
  }) {
    // Validar se o valor total corresponde à soma dos valores individuais
    const totalRecipientsAmount = data.recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
    if (Math.abs(totalRecipientsAmount - data.totalAmount) > 0.01) {
      throw new BadRequestException('O valor total deve corresponder à soma dos valores individuais');
    }

    // Validar se as carteiras existem
    const wallets = await this.prisma.wallet.findMany({
      where: {
        id: {
          in: [data.fromWalletId, ...data.recipients.map(r => r.walletId)],
        },
      },
    });

    if (wallets.length !== data.recipients.length + 1) {
      throw new BadRequestException('Uma ou mais carteiras não foram encontradas');
    }

    // Criar transação principal de rateio
    const transaction = await this.transactionsService.createTransaction({
      fromWalletId: data.fromWalletId,
      toWalletId: data.fromWalletId, // Auto-transação para rateio
      fromUserId: data.fromUserId,
      toUserId: data.fromUserId,
      type: TransactionType.RATEIO,
      amount: data.totalAmount,
      currency: data.currency,
      description: data.description,
      notes: `Rateio com ${data.recipients.length} participantes`,
      recipients: data.recipients,
      scheduleDate: data.scheduleDate,
    });

    // Criar registros de destinatários do rateio
    const rateioRecipients = await Promise.all(
      data.recipients.map(recipient =>
        this.prisma.rateioRecipient.create({
          data: {
            transactionId: transaction.id,
            walletId: recipient.walletId,
            amount: recipient.amount,
            percentage: recipient.percentage,
            status: 'PENDING',
          },
        })
      )
    );

    // Se não há data agendada, processar imediatamente
    if (!data.scheduleDate) {
      await this.processRateio(transaction.id);
    } else {
      // Agendar processamento
      const delay = new Date(data.scheduleDate).getTime() - Date.now();
      await this.rateioQueue.add(
        'process-rateio',
        { transactionId: transaction.id },
        { delay: Math.max(0, delay) }
      );
    }

    // Notificar participantes
    await this.notifyRateioParticipants(transaction.id, data.recipients);

    return {
      id: transaction.id,
      fromWalletId: data.fromWalletId,
      toWalletId: data.fromWalletId,
      fromUserId: data.fromUserId,
      toUserId: data.fromUserId,
      totalAmount: data.totalAmount,
      description: data.description,
      status: 'PENDING' as any,
      participants: rateioRecipients.map(r => ({
        id: r.id,
        userId: r.walletId, // TODO: Get actual userId
        amount: r.amount,
        status: r.status as any,
        confirmedAt: null,
        paidAt: null,
        message: '',
      })),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      scheduleDate: data.scheduleDate,
      completedAt: null,
      metadata: {},
    };
  }

  async processRateio(transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: TransactionType.RATEIO,
        status: 'PENDING',
      },
      include: {
        rateioRecipients: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Rateio não encontrado');
    }

    let completedRecipients = 0;
    const totalRecipients = transaction.rateioRecipients.length;

    for (const recipient of transaction.rateioRecipients) {
      if (recipient.status === 'PENDING') {
        try {
          // Processar pagamento individual
          await this.transactionsService.createTransaction({
            fromWalletId: transaction.fromWalletId,
            toWalletId: recipient.walletId,
            fromUserId: transaction.fromUserId,
            toUserId: recipient.wallet.userId,
            type: TransactionType.TRANSFER,
            amount: recipient.amount,
            currency: transaction.currency,
            description: `Rateio: ${transaction.description}`,
            notes: `Pagamento de rateio - ${recipient.percentage}%`,
          });

          // Atualizar status do destinatário
          await this.prisma.rateioRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'PAID',
              // paidAt: new Date(), // TODO: Add paidAt field to schema
            },
          });

          completedRecipients++;

          // Notificar destinatário
          await this.notificationsService.createNotification({
            userId: recipient.wallet.userId,
            type: NotificationType.PAYMENT_RECEIVED,
            title: 'Pagamento de Rateio Recebido',
            message: `Você recebeu ${recipient.amount} ${transaction.currency} do rateio "${transaction.description}"`,
            data: {
              transactionId: transaction.id,
              amount: recipient.amount,
              currency: transaction.currency,
            },
          });
        } catch (error) {
          console.error(`Erro ao processar pagamento para destinatário ${recipient.id}:`, error);
          
          // Marcar como falha
          await this.prisma.rateioRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
            },
          });
        }
      }
    }

    // Atualizar status da transação principal
    const allCompleted = transaction.rateioRecipients.every(r => r.status === 'PAID');
    const allFailed = transaction.rateioRecipients.every(r => r.status === 'FAILED');

    let newStatus = 'PENDING';
    if (allCompleted) {
      newStatus = 'COMPLETED';
    } else if (allFailed) {
      newStatus = 'FAILED';
    } else if (completedRecipients > 0) {
      newStatus = 'PARTIAL';
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: newStatus as any,
        completedAt: allCompleted || allFailed ? new Date() : null,
      },
    });

    return { message: `Rateio processado: ${completedRecipients}/${totalRecipients} pagamentos realizados` };
  }

  async getRateioHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
        },
        include: {
          rateioRecipients: {
            include: {
              wallet: {
                select: {
                  walletNumber: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
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

  async getRateioDetails(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: TransactionType.RATEIO,
        OR: [
          { fromUserId: userId },
          {
            rateioRecipients: {
              some: {
                wallet: { userId },
              },
            },
          },
        ],
      },
      include: {
        rateioRecipients: {
          include: {
            wallet: {
              select: {
                walletNumber: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Rateio não encontrado');
    }

    return transaction;
  }

  async getUserRateios(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          fromUserId: userId,
          type: TransactionType.RATEIO,
        },
        include: {
          rateioRecipients: {
            include: {
              wallet: {
                select: {
                  walletNumber: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          fromUserId: userId,
          type: TransactionType.RATEIO,
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

  async getRateioById(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id,
        type: TransactionType.RATEIO,
        OR: [
          { fromUserId: userId },
          {
            rateioRecipients: {
              some: {
                wallet: { userId },
              },
            },
          },
        ],
      },
      include: {
        rateioRecipients: {
          include: {
            wallet: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
        fromUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Rateio não encontrado');
    }

    return {
      id: transaction.id,
      fromWalletId: transaction.fromWalletId,
      toWalletId: transaction.toWalletId,
      fromUserId: transaction.fromUserId,
      toUserId: transaction.toUserId,
      totalAmount: transaction.amount,
      description: transaction.description,
      status: transaction.status as any,
      participants: transaction.rateioRecipients.map(r => ({
        id: r.id,
        userId: r.wallet.user.id,
        amount: r.amount,
        status: r.status as any,
        confirmedAt: null,
        paidAt: null,
        message: '',
      })),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      scheduleDate: transaction.scheduleDate,
      completedAt: transaction.completedAt,
      metadata: transaction.metadata as any,
    };
  }

  async confirmRateio(transactionId: string, userId: string) {
    const rateioRecipient = await this.prisma.rateioRecipient.findFirst({
      where: {
        transactionId,
        wallet: { userId },
        status: 'PENDING',
      },
      include: {
        transaction: true,
      },
    });

    if (!rateioRecipient) {
      throw new NotFoundException('Rateio não encontrado ou já processado');
    }

    // Atualizar status do destinatário
    const updatedRecipient = await this.prisma.rateioRecipient.update({
      where: { id: rateioRecipient.id },
      data: { status: 'CONFIRMED' },
      include: {
        transaction: true,
      },
    });

    // Verificar se todos os destinatários confirmaram
    const allRecipients = await this.prisma.rateioRecipient.findMany({
      where: { transactionId },
    });

    const allConfirmed = allRecipients.every(r => r.status === 'CONFIRMED');

    if (allConfirmed) {
      // Processar rateio
      await this.processRateio(transactionId);
    }

    // Notificar criador do rateio
    await this.notificationsService.createNotification({
      userId: rateioRecipient.transaction.fromUserId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Rateio Confirmado',
      message: `Um participante confirmou o rateio "${rateioRecipient.transaction.description}"`,
      data: { transactionId, confirmedBy: userId },
    });

    return {
      id: updatedRecipient.transaction.id,
      fromWalletId: updatedRecipient.transaction.fromWalletId,
      toWalletId: updatedRecipient.transaction.toWalletId,
      fromUserId: updatedRecipient.transaction.fromUserId,
      toUserId: updatedRecipient.transaction.toUserId,
      totalAmount: updatedRecipient.transaction.amount,
      description: updatedRecipient.transaction.description,
      status: updatedRecipient.transaction.status as any,
      participants: [],
      createdAt: updatedRecipient.transaction.createdAt,
      updatedAt: updatedRecipient.transaction.updatedAt,
      scheduleDate: updatedRecipient.transaction.scheduleDate,
      completedAt: updatedRecipient.transaction.completedAt,
      metadata: updatedRecipient.transaction.metadata as any,
    };
  }

  async declineRateio(transactionId: string, userId: string) {
    const rateioRecipient = await this.prisma.rateioRecipient.findFirst({
      where: {
        transactionId,
        wallet: { userId },
        status: 'PENDING',
      },
      include: {
        transaction: true,
      },
    });

    if (!rateioRecipient) {
      throw new NotFoundException('Rateio não encontrado ou já processado');
    }

    // Atualizar status do destinatário
    const updatedRecipient = await this.prisma.rateioRecipient.update({
      where: { id: rateioRecipient.id },
      data: { status: 'DECLINED' },
      include: {
        transaction: true,
      },
    });

    // Notificar criador do rateio
    await this.notificationsService.createNotification({
      userId: rateioRecipient.transaction.fromUserId,
      type: NotificationType.PAYMENT_SENT,
      title: 'Rateio Recusado',
      message: `Um participante recusou o rateio "${rateioRecipient.transaction.description}"`,
      data: { transactionId, declinedBy: userId },
    });

    return {
      id: updatedRecipient.transaction.id,
      fromWalletId: updatedRecipient.transaction.fromWalletId,
      toWalletId: updatedRecipient.transaction.toWalletId,
      fromUserId: updatedRecipient.transaction.fromUserId,
      toUserId: updatedRecipient.transaction.toUserId,
      totalAmount: updatedRecipient.transaction.amount,
      description: updatedRecipient.transaction.description,
      status: updatedRecipient.transaction.status as any,
      participants: [],
      createdAt: updatedRecipient.transaction.createdAt,
      updatedAt: updatedRecipient.transaction.updatedAt,
      scheduleDate: updatedRecipient.transaction.scheduleDate,
      completedAt: updatedRecipient.transaction.completedAt,
      metadata: updatedRecipient.transaction.metadata as any,
    };
  }

  async cancelRateio(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        fromUserId: userId,
        type: TransactionType.RATEIO,
        status: 'PENDING',
      },
    });

    if (!transaction) {
      throw new NotFoundException('Rateio não encontrado ou não pode ser cancelado');
    }

    // Atualizar status da transação
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'CANCELLED' },
    });

    // Atualizar status dos destinatários
    await this.prisma.rateioRecipient.updateMany({
      where: { transactionId },
      data: { status: 'CANCELLED' },
    });

    // Notificar participantes
    const recipients = await this.prisma.rateioRecipient.findMany({
      where: { transactionId },
      include: { wallet: true },
    });

    for (const recipient of recipients) {
      await this.notificationsService.createNotification({
        userId: recipient.wallet.userId,
        type: NotificationType.PAYMENT_REQUEST,
        title: 'Rateio Cancelado',
        message: `O rateio "${transaction.description}" foi cancelado`,
        data: { transactionId },
      });
    }

    return {
      id: updatedTransaction.id,
      fromWalletId: updatedTransaction.fromWalletId,
      toWalletId: updatedTransaction.toWalletId,
      fromUserId: updatedTransaction.fromUserId,
      toUserId: updatedTransaction.toUserId,
      totalAmount: updatedTransaction.amount,
      description: updatedTransaction.description,
      status: updatedTransaction.status as any,
      participants: [],
      createdAt: updatedTransaction.createdAt,
      updatedAt: updatedTransaction.updatedAt,
      scheduleDate: updatedTransaction.scheduleDate,
      completedAt: updatedTransaction.completedAt,
      metadata: updatedTransaction.metadata as any,
    };
  }

  async getPendingRateios(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [rateios, total] = await Promise.all([
      this.prisma.rateioRecipient.findMany({
        where: {
          wallet: { userId },
          status: 'PENDING',
        },
        include: {
          transaction: {
            include: {
              fromUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          wallet: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rateioRecipient.count({
        where: {
          wallet: { userId },
          status: 'PENDING',
        },
      }),
    ]);

    return {
      rateios,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getRateioStats(userId: string) {
    const [
      totalRateios,
      activeRateios,
      completedRateios,
      cancelledRateios,
      totalAmount,
      averageAmount,
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
          status: 'PENDING',
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
          status: 'COMPLETED',
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
          status: 'CANCELLED',
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          OR: [
            { fromUserId: userId, type: TransactionType.RATEIO },
            {
              rateioRecipients: {
                some: {
                  wallet: { userId },
                },
              },
            },
          ],
        },
        _avg: {
          amount: true,
        },
      }),
    ]);

    return {
      totalRateios,
      activeRateios,
      completedRateios,
      cancelledRateios,
      totalAmount: totalAmount._sum.amount || 0,
      averageAmount: averageAmount._avg.amount || 0,
    };
  }

  

  private async notifyRateioParticipants(
    _transactionId: string,
    recipients: Array<{ userId: string; amount: number; percentage: number }>
  ) {
    for (const recipient of recipients) {
      await this.notificationsService.createNotification({
        userId: recipient.userId,
        type: NotificationType.PAYMENT_REQUEST,
        title: 'Novo Rateio Disponível',
        message: `Você foi convidado para participar de um rateio de ${recipient.amount}`,
        data: {
          transactionId: _transactionId,
          amount: recipient.amount,
          percentage: recipient.percentage,
        },
      });
    }
  }
}