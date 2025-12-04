import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RequestStatus, NotificationType, Currency, RequestCategory, AccountType, TransactionType } from '@prisma/client';
import * as QRCode from 'qrcode';

@Injectable()
export class PaymentRequestsService {
  private readonly logger = new Logger(PaymentRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
  ) {}

  async createPaymentRequest(data: {
    requesterId: string;
    payerId: string | null;
    amount: number;
    currency: Currency;
    description: string;
    category: RequestCategory;
    expiresAt?: Date;
    metadata?: any;
  }) {
    // Resolver payerId (pode ser telefone ou UUID)
    let resolvedPayerId: string | null = null;
    
    if (data.payerId) {
      resolvedPayerId = await this.resolvePayerId(data.payerId);
      if (!resolvedPayerId) {
        throw new NotFoundException(`Usuário não encontrado: ${data.payerId} (pode ser telefone ou ID)`);
      }

      // NOTA: Permitir payment request para si mesmo (útil para testes e alguns casos de uso)
      // Se quiser bloquear isso em produção, descomente a validação abaixo:
      /*
      if (resolvedPayerId === data.requesterId) {
        throw new BadRequestException('Não é possível criar uma solicitação de pagamento para si mesmo');
      }
      */

      this.logger.debug('Payer resolvido', {
        originalPayerId: data.payerId,
        resolvedPayerId,
        requesterId: data.requesterId,
        isSelfPayment: resolvedPayerId === data.requesterId
      });
    }

    // Definir data de expiração padrão (7 dias) se não fornecida
    const expiresAt = data.expiresAt || (() => {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    })();

    // Criar solicitação de pagamento
    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        requester: {
          connect: { id: data.requesterId }
        },
        payerId: resolvedPayerId, // Pode ser null para payment links públicos
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category,
        status: RequestStatus.PENDING,
        expiresAt,
        metadata: data.metadata,
      },
    });

    // Notificar usuário destinatário apenas se payerId foi fornecido (NÃO-BLOQUEANTE)
    // Fire-and-forget: não esperamos pela conclusão da notificação
    if (resolvedPayerId) {
      this.logger.debug('Criando notificação para payer', { 
        payerId: resolvedPayerId, 
        paymentRequestId: paymentRequest.id 
      });
      
      this.notificationsService.createNotification({
        userId: resolvedPayerId,
        type: NotificationType.PAYMENT_REQUEST,
        title: 'Nova Solicitação de Pagamento',
        message: `Você recebeu uma solicitação de pagamento de ${data.amount} ${data.currency}`,
        data: { paymentRequestId: paymentRequest.id },
      }).catch((error) => {
        // Log do erro mas não falha a criação do payment request
        this.logger.warn('Erro ao enviar notificação (não crítico)', { error: error.message });
      });
    } else {
      this.logger.debug('PayerId não fornecido, notificação não será enviada');
    }

    // Retornar payment request imediatamente (não espera notificações)
    return this.formatPaymentRequestResponse(paymentRequest);
  }

  async getUserPaymentRequests(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [paymentRequests, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: { requesterId: userId },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentRequest.count({
        where: { requesterId: userId },
      }),
    ]);

    // Formatar payment requests
    const formattedPaymentRequests = paymentRequests.map((pr) => 
      this.formatPaymentRequestResponse(pr)
    );

    return {
      paymentRequests: formattedPaymentRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getReceivedPaymentRequests(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [paymentRequests, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: { payerId: userId },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentRequest.count({
        where: { payerId: userId },
      }),
    ]);

    // Formatar payment requests
    const formattedPaymentRequests = paymentRequests.map((pr) => 
      this.formatPaymentRequestResponse(pr)
    );

    return {
      paymentRequests: formattedPaymentRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentRequestById(id: string, userId: string) {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        id,
        OR: [
          { requesterId: userId },
          { payerId: userId },
        ],
      },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Solicitação de pagamento não encontrada');
    }

    return this.formatPaymentRequestResponse(paymentRequest);
  }

  async approvePaymentRequest(id: string, userId: string, pin: string) {
    this.logger.log('Iniciando aprovação de payment request', { paymentRequestId: id, payerId: userId });

    // 1. Buscar payment request
    // Primeiro, buscar o payment request sem filtro de payerId para verificar se existe
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        id,
        status: RequestStatus.PENDING,
      },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Solicitação de pagamento não encontrada ou não está pendente');
    }

    // 2. Validar autorização para pagar
    // Se payerId for null (payment link público), qualquer usuário pode pagar (exceto o próprio requester)
    // Se payerId não for null, apenas o payer específico pode pagar
    if (paymentRequest.payerId !== null && paymentRequest.payerId !== userId) {
      throw new NotFoundException('Solicitação de pagamento não encontrada ou não autorizada');
    }

    // Validar que o usuário não está tentando pagar para si mesmo (se for payment link público)
    if (paymentRequest.payerId === null && paymentRequest.requesterId === userId) {
      throw new BadRequestException('Não é possível pagar sua própria solicitação de pagamento');
    }

    // 2. Verificar se não expirou
    if (paymentRequest.expiresAt && new Date() > paymentRequest.expiresAt) {
      throw new BadRequestException('Solicitação de pagamento expirada');
    }

    // 3. Buscar carteiras padrão do pagador e do solicitante
    this.logger.debug('Buscando carteiras padrão', { payerId: userId, requesterId: paymentRequest.requesterId });
    
    const [payerWallet, requesterWallet] = await Promise.all([
      this.prisma.wallet.findFirst({
        where: {
          userId: userId,
          isDefault: true,
          status: 'ACTIVE',
        },
      }),
      this.prisma.wallet.findFirst({
        where: {
          userId: paymentRequest.requesterId,
          isDefault: true,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (!payerWallet) {
      throw new NotFoundException('Carteira padrão do pagador não encontrada');
    }

    if (!requesterWallet) {
      throw new NotFoundException('Carteira padrão do solicitante não encontrada');
    }

    this.logger.debug('Carteiras encontradas', {
      payerWalletId: payerWallet.id,
      requesterWalletId: requesterWallet.id,
    });

    // 4. Criar transação usando TransactionsService
    this.logger.debug('Criando transação', {
      fromWalletId: payerWallet.id,
      toWalletId: requesterWallet.id,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
    });

    const transaction = await this.transactionsService.createTransaction({
      fromWalletId: payerWallet.id,
      fromUserId: userId,
      toWalletId: requesterWallet.id,
      toUserId: paymentRequest.requesterId,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      description: `Pagamento de solicitação: ${paymentRequest.description}`,
      type: TransactionType.PAYMENT_REQUEST,
      pin: pin,
      metadata: {
        paymentRequestId: paymentRequest.id,
        category: paymentRequest.category,
      },
    });

    this.logger.log('Transação criada com sucesso', { transactionId: transaction.id });

    // 5. Atualizar status do payment request para PAID
    const updatedRequest = await this.prisma.paymentRequest.update({
      where: { id },
      data: { 
        status: RequestStatus.PAID,
        paidAt: new Date(),
        metadata: {
          ...(paymentRequest.metadata as Record<string, any> || {}),
          transactionId: transaction.id,
          transactionReference: transaction.reference,
        },
      },
    });

    this.logger.debug('Payment request atualizado', { status: updatedRequest.status });

    // 6. Notificar ambas as partes (NÃO-BLOQUEANTE para melhor performance)
    // Fire-and-forget: não esperamos pela conclusão das notificações
    Promise.all([
      // Notificar solicitante (recebeu o pagamento)
      this.notificationsService.createNotification({
        userId: paymentRequest.requesterId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Pagamento Recebido',
        message: `Você recebeu ${paymentRequest.amount} ${paymentRequest.currency} de ${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName}`,
        data: { 
          paymentRequestId: paymentRequest.id,
          transactionId: transaction.id,
          transactionReference: transaction.reference,
        },
      }),
      // Notificar pagador (pagamento realizado)
      this.notificationsService.createNotification({
        userId: userId,
        type: NotificationType.PAYMENT_SENT,
        title: 'Pagamento Realizado',
        message: `Você pagou ${paymentRequest.amount} ${paymentRequest.currency} para ${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName}`,
        data: { 
          paymentRequestId: paymentRequest.id,
          transactionId: transaction.id,
          transactionReference: transaction.reference,
        },
      }),
    ]).catch((error) => {
      // Log do erro mas não falha a aprovação
      this.logger.warn('Erro ao enviar notificações (não crítico)', { error: error.message });
    });

    this.logger.log('Payment request aprovado com sucesso', { 
      paymentRequestId: id, 
      transactionId: transaction.id 
    });

    return this.formatPaymentRequestResponse(updatedRequest);
  }

  async rejectPaymentRequest(id: string, userId: string, reason?: string) {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        id,
        payerId: userId,
        status: RequestStatus.PENDING,
      },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Solicitação de pagamento não encontrada ou não autorizada');
    }

    // Preparar metadata atual
    const currentMetadata = paymentRequest.metadata as Record<string, any> || {};
    const updatedMetadata = {
      ...currentMetadata,
      rejectionReason: reason,
    };

    // Atualizar status para CANCELLED
    const updatedRequest = await this.prisma.paymentRequest.update({
      where: { id },
      data: { 
        status: RequestStatus.CANCELLED,
        metadata: updatedMetadata,
      },
    });

    // Notificar solicitante
    await this.notificationsService.createNotification({
      userId: paymentRequest.requesterId,
      type: NotificationType.PAYMENT_SENT,
      title: 'Solicitação de Pagamento Rejeitada',
      message: `Sua solicitação de pagamento de ${paymentRequest.amount} ${paymentRequest.currency} foi rejeitada`,
      data: { paymentRequestId: paymentRequest.id, reason },
    });

    return this.formatPaymentRequestResponse(updatedRequest);
  }

  async cancelPaymentRequest(id: string, userId: string) {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        id,
        requesterId: userId,
        status: RequestStatus.PENDING,
      },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Solicitação de pagamento não encontrada ou não autorizada');
    }

    // Atualizar status para CANCELLED
    const updatedRequest = await this.prisma.paymentRequest.update({
      where: { id },
      data: { status: RequestStatus.CANCELLED },
    });

    // Notificar destinatário (apenas se payerId existir e for válido)
    if (paymentRequest.payerId) {
      const payer = await this.prisma.user.findUnique({
        where: { id: paymentRequest.payerId },
        select: { id: true },
      }).catch(() => null);

      if (payer) {
        this.notificationsService.createNotification({
          userId: paymentRequest.payerId,
          type: NotificationType.PAYMENT_REQUEST,
          title: 'Solicitação de Pagamento Cancelada',
          message: `Uma solicitação de pagamento de ${paymentRequest.amount} ${paymentRequest.currency} foi cancelada`,
          data: { paymentRequestId: paymentRequest.id },
        }).catch((error) => {
          this.logger.warn('Erro ao enviar notificação de cancelamento (não crítico)', { error: error.message });
        });
      } else {
        this.logger.warn('Payer não encontrado ao cancelar payment request', { payerId: paymentRequest.payerId });
      }
    }

    return this.formatPaymentRequestResponse(updatedRequest);
  }

  async getPendingPaymentRequests(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [paymentRequests, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: { 
          payerId: userId,
          status: RequestStatus.PENDING,
        },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentRequest.count({
        where: { 
          payerId: userId,
          status: RequestStatus.PENDING,
        },
      }),
    ]);

    // Formatar payment requests
    const formattedPaymentRequests = paymentRequests.map((pr) => 
      this.formatPaymentRequestResponse(pr)
    );

    return {
      paymentRequests: formattedPaymentRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentRequestStats(userId: string) {
    const [
      totalSent,
      totalReceived,
      pendingSent,
      pendingReceived,
      approvedSent,
      approvedReceived,
      rejectedSent,
      rejectedReceived,
      totalAmountSent,
      totalAmountReceived,
    ] = await Promise.all([
      this.prisma.paymentRequest.count({
        where: { requesterId: userId },
      }),
      this.prisma.paymentRequest.count({
        where: { payerId: userId },
      }),
      this.prisma.paymentRequest.count({
        where: { requesterId: userId, status: RequestStatus.PENDING },
      }),
      this.prisma.paymentRequest.count({
        where: { payerId: userId, status: RequestStatus.PENDING },
      }),
      this.prisma.paymentRequest.count({
        where: { requesterId: userId, status: RequestStatus.PAID },
      }),
      this.prisma.paymentRequest.count({
        where: { payerId: userId, status: RequestStatus.PAID },
      }),
      this.prisma.paymentRequest.count({
        where: { requesterId: userId, status: RequestStatus.CANCELLED },
      }),
      this.prisma.paymentRequest.count({
        where: { payerId: userId, status: RequestStatus.CANCELLED },
      }),
      this.prisma.paymentRequest.aggregate({
        where: { requesterId: userId, status: RequestStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.paymentRequest.aggregate({
        where: { payerId: userId, status: RequestStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalSent,
      totalReceived,
      pendingSent,
      pendingReceived,
      approvedSent,
      approvedReceived,
      rejectedSent,
      rejectedReceived,
      totalAmountSent: totalAmountSent._sum.amount || 0,
      totalAmountReceived: totalAmountReceived._sum.amount || 0,
    };
  }

  // Funcionalidades específicas para MERCHANT

  async getMerchantStats(userId: string) {
    // Verificar se o usuário tem carteira MERCHANT
    const merchantWallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        accountType: AccountType.MERCHANT,
        status: 'ACTIVE',
      },
    });

    if (!merchantWallet) {
      throw new BadRequestException('Usuário não possui carteira MERCHANT');
    }

    // Obter estatísticas de pedidos de pagamento do merchant
    const stats = await this.getPaymentRequestStats(userId);
    
    // Adicionar estatísticas específicas de merchant
    const merchantStats = {
      ...stats,
      merchantWalletId: merchantWallet.id,
      storeName: (merchantWallet.merchantInfo as any)?.storeName || 'N/A',
      qrCodeEnabled: (merchantWallet.merchantInfo as any)?.qrCodeEnabled || false,
      paymentLinkEnabled: (merchantWallet.merchantInfo as any)?.paymentLinkEnabled || false,
    };

    return merchantStats;
  }

  /**
   * Resolve payerId (pode ser telefone ou UUID) para o ID do usuário
   * Retorna null se não encontrado
   */
  private async resolvePayerId(payerIdOrPhone: string): Promise<string | null> {
    // Verificar se é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(payerIdOrPhone)) {
      // É um UUID, buscar diretamente
      const user = await this.prisma.user.findUnique({
        where: { id: payerIdOrPhone },
        select: { id: true },
      }).catch(() => null);
      
      return user?.id || null;
    } else {
      // Provavelmente é um telefone, buscar por telefone
      const user = await this.prisma.user.findUnique({
        where: { phone: payerIdOrPhone },
        select: { id: true },
      }).catch(() => null);
      
      if (user) {
        this.logger.debug('Payer resolvido por telefone', { phone: payerIdOrPhone, userId: user.id });
        return user.id;
      }
      
      return null;
    }
  }


  /**
   * Formata payment request para resposta
   */
  private formatPaymentRequestResponse(paymentRequest: any) {
    return {
      ...paymentRequest,
    };
  }

  async getPaymentQRData(paymentRequestId: string, userId: string) {
    const paymentRequest = await this.getPaymentRequestById(paymentRequestId, userId);

    // Verificar se o usuário tem carteira MERCHANT
    const merchantWallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        accountType: AccountType.MERCHANT,
        status: 'ACTIVE',
      },
    });

    if (!merchantWallet) {
      throw new BadRequestException('Apenas carteiras MERCHANT podem gerar QR codes');
    }

    const merchantInfo = merchantWallet.merchantInfo as any;
    if (!merchantInfo?.qrCodeEnabled) {
      throw new BadRequestException('QR Code não está habilitado para esta carteira MERCHANT');
    }

    // Gerar URL do pagamento
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentUrl = `${appUrl}/payment/${paymentRequestId}`;

    return {
      paymentUrl,
      paymentRequestId: paymentRequest.id,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency.toString(),
      description: paymentRequest.description,
      expiresAt: paymentRequest.expiresAt,
      merchantInfo: {
        storeName: merchantInfo.storeName,
        category: merchantInfo.category,
      },
      qrOptions: {
        size: 300,
        margin: 2,
        errorCorrectionLevel: 'M' as const,
      },
    };
  }

  async generatePaymentQRCode(paymentRequestId: string, userId: string): Promise<string> {
    // Manter método para compatibilidade (gera imagem)
    const qrData = await this.getPaymentQRData(paymentRequestId, userId);
    
    // Gerar QR Code como imagem (para casos específicos como PDF, email)
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData.paymentUrl, {
        width: qrData.qrOptions?.size || 300,
        margin: qrData.qrOptions?.margin || 2,
        errorCorrectionLevel: qrData.qrOptions?.errorCorrectionLevel || 'M',
      });
      return qrCodeDataUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Erro ao gerar QR Code', { error: errorMessage, paymentRequestId });
      throw new BadRequestException('Erro ao gerar QR Code');
    }
  }

  async generatePaymentLink(
    userId: string,
    amount: number,
    currency: Currency,
    description: string,
    expiresInDays: number = 7
  ): Promise<{ paymentRequestId: string; paymentLink: string }> {
    // Verificar se o usuário tem carteira MERCHANT
    const merchantWallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        accountType: AccountType.MERCHANT,
        status: 'ACTIVE',
      },
    });

    if (!merchantWallet) {
      throw new BadRequestException('Apenas carteiras MERCHANT podem gerar links de pagamento');
    }

    const merchantInfo = merchantWallet.merchantInfo as any;
    if (!merchantInfo?.paymentLinkEnabled) {
      throw new BadRequestException('Links de pagamento não estão habilitados para esta carteira MERCHANT');
    }

    // Criar pedido de pagamento sem payerId específico (link público)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        requesterId: userId,
        payerId: null, // Link público, qualquer um pode pagar
        amount,
        currency,
        description,
        category: RequestCategory.SERVICE,
        status: RequestStatus.PENDING,
        expiresAt,
        metadata: {
          isPaymentLink: true,
          merchantWalletId: merchantWallet.id,
          storeName: merchantInfo.storeName,
        },
      },
    });

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentLink = `${appUrl}/payment/${paymentRequest.id}`;

    return {
      paymentRequestId: paymentRequest.id,
      paymentLink,
    };
  }

  async getMerchantPaymentLinks(userId: string, page: number = 1, limit: number = 20) {
    // Verificar se o usuário tem carteira MERCHANT
    const merchantWallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        accountType: AccountType.MERCHANT,
        status: 'ACTIVE',
      },
    });

    if (!merchantWallet) {
      throw new BadRequestException('Usuário não possui carteira MERCHANT');
    }

    const skip = (page - 1) * limit;

    const [paymentRequests, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: {
          requesterId: userId,
          payerId: null, // Apenas links públicos
          metadata: {
            path: ['isPaymentLink'],
            equals: true,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentRequest.count({
        where: {
          requesterId: userId,
          payerId: null,
          metadata: {
            path: ['isPaymentLink'],
            equals: true,
          },
        },
      }),
    ]);

    return {
      paymentLinks: paymentRequests.map(pr => ({
        id: pr.id,
        amount: pr.amount,
        currency: pr.currency,
        description: pr.description,
        status: pr.status,
        expiresAt: pr.expiresAt,
        createdAt: pr.createdAt,
        paymentLink: `${process.env.APP_URL || 'http://localhost:3000'}/payment/${pr.id}`,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
