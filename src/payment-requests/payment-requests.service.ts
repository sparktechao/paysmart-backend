import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestStatus, NotificationType, Currency, RequestCategory, AccountType } from '@prisma/client';
import * as QRCode from 'qrcode';

@Injectable()
export class PaymentRequestsService {
  private readonly logger = new Logger(PaymentRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
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
    // Verificar se o usuário destinatário existe (apenas se payerId foi fornecido)
    if (data.payerId) {
      const payer = await this.prisma.user.findUnique({
        where: { id: data.payerId },
      });

      if (!payer) {
        throw new NotFoundException('Usuário destinatário não encontrado');
      }
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
        payerId: data.payerId, // Pode ser null para payment links públicos
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category,
        status: RequestStatus.PENDING,
        expiresAt,
        metadata: data.metadata,
      },
    });

    // Gerar qrData se aplicável
    const qrData = await this.generateQRDataIfApplicable(paymentRequest.id, data.requesterId);

    // Notificar usuário destinatário apenas se payerId foi fornecido
    if (data.payerId) {
      await this.notificationsService.createNotification({
        userId: data.payerId,
        type: NotificationType.PAYMENT_REQUEST,
        title: 'Nova Solicitação de Pagamento',
        message: `Você recebeu uma solicitação de pagamento de ${data.amount} ${data.currency}`,
        data: { paymentRequestId: paymentRequest.id },
      });
    }

    // Retornar payment request com qrData se aplicável
    return this.formatPaymentRequestResponse(paymentRequest, qrData);
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

    // Adicionar qrData para cada payment request quando aplicável
    const paymentRequestsWithQRData = await Promise.all(
      paymentRequests.map(async (pr) => {
        const qrData = await this.generateQRDataIfApplicable(pr.id, pr.requesterId);
        return this.formatPaymentRequestResponse(pr, qrData);
      })
    );

    return {
      paymentRequests: paymentRequestsWithQRData,
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

    // Adicionar qrData para cada payment request quando aplicável
    const paymentRequestsWithQRData = await Promise.all(
      paymentRequests.map(async (pr) => {
        const qrData = await this.generateQRDataIfApplicable(pr.id, pr.requesterId);
        return this.formatPaymentRequestResponse(pr, qrData);
      })
    );

    return {
      paymentRequests: paymentRequestsWithQRData,
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

    // Gerar qrData se aplicável (apenas se o requester for MERCHANT)
    const qrData = await this.generateQRDataIfApplicable(paymentRequest.id, paymentRequest.requesterId);

    return this.formatPaymentRequestResponse(paymentRequest, qrData);
  }

  async approvePaymentRequest(id: string, userId: string) {
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

    // Atualizar status para PAID
    const updatedRequest = await this.prisma.paymentRequest.update({
      where: { id },
      data: { 
        status: RequestStatus.PAID,
        paidAt: new Date(),
      },
    });

    // Notificar solicitante
    await this.notificationsService.createNotification({
      userId: paymentRequest.requesterId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Solicitação de Pagamento Aprovada',
      message: `Sua solicitação de pagamento de ${paymentRequest.amount} ${paymentRequest.currency} foi aprovada`,
      data: { paymentRequestId: paymentRequest.id },
    });

    // Gerar qrData se aplicável
    const qrData = await this.generateQRDataIfApplicable(updatedRequest.id, updatedRequest.requesterId);
    return this.formatPaymentRequestResponse(updatedRequest, qrData);
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

    // Gerar qrData se aplicável
    const qrData = await this.generateQRDataIfApplicable(updatedRequest.id, updatedRequest.requesterId);
    return this.formatPaymentRequestResponse(updatedRequest, qrData);
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

    // Notificar destinatário
    await this.notificationsService.createNotification({
      userId: paymentRequest.payerId,
      type: NotificationType.PAYMENT_REQUEST,
      title: 'Solicitação de Pagamento Cancelada',
      message: `Uma solicitação de pagamento de ${paymentRequest.amount} ${paymentRequest.currency} foi cancelada`,
      data: { paymentRequestId: paymentRequest.id },
    });

    // Gerar qrData se aplicável
    const qrData = await this.generateQRDataIfApplicable(updatedRequest.id, updatedRequest.requesterId);
    return this.formatPaymentRequestResponse(updatedRequest, qrData);
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

    // Adicionar qrData para cada payment request quando aplicável
    const paymentRequestsWithQRData = await Promise.all(
      paymentRequests.map(async (pr) => {
        const qrData = await this.generateQRDataIfApplicable(pr.id, pr.requesterId);
        return this.formatPaymentRequestResponse(pr, qrData);
      })
    );

    return {
      paymentRequests: paymentRequestsWithQRData,
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
   * Gera dados do QR code se o requester for MERCHANT com QR habilitado
   * Retorna undefined se não aplicável
   */
  private async generateQRDataIfApplicable(
    paymentRequestId: string,
    requesterId: string,
  ): Promise<{ paymentUrl: string; qrOptions: any; merchantInfo?: any } | undefined> {
    try {
      // Verificar se o requester tem carteira MERCHANT
      const merchantWallet = await this.prisma.wallet.findFirst({
        where: {
          userId: requesterId,
          accountType: AccountType.MERCHANT,
          status: 'ACTIVE',
        },
      });

      if (!merchantWallet) {
        return undefined;
      }

      const merchantInfo = merchantWallet.merchantInfo as any;
      if (!merchantInfo?.qrCodeEnabled) {
        return undefined;
      }

      // Gerar URL do pagamento
      const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const paymentUrl = `${appUrl}/payment/${paymentRequestId}`;

      return {
        paymentUrl,
        qrOptions: {
          size: 300,
          margin: 2,
          errorCorrectionLevel: 'M' as const,
        },
        merchantInfo: {
          storeName: merchantInfo.storeName,
          category: merchantInfo.category,
        },
      };
    } catch (error) {
      // Se houver erro, não incluir qrData
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('Erro ao gerar qrData para payment request', { error: errorMessage, paymentRequestId, requesterId });
      return undefined;
    }
  }

  /**
   * Formata payment request com qrData se disponível
   */
  private formatPaymentRequestResponse(
    paymentRequest: any,
    qrData?: { paymentUrl: string; qrOptions: any; merchantInfo?: any } | undefined,
  ) {
    return {
      ...paymentRequest,
      qrData: qrData || undefined,
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
  ): Promise<{ paymentRequestId: string; paymentLink: string; qrData?: any }> {
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

    // Retornar dados do QR code se estiver habilitado (frontend gera)
    let qrData: any | undefined;
    if (merchantInfo.qrCodeEnabled) {
      qrData = {
        paymentUrl: paymentLink,
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

    return {
      paymentRequestId: paymentRequest.id,
      paymentLink,
      qrData,
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
