import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestStatus, NotificationType, Currency, RequestCategory } from '@prisma/client';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createPaymentRequest(data: {
    requesterId: string;
    payerId: string;
    amount: number;
    currency: Currency;
    description: string;
    category: RequestCategory;
    expiresAt?: Date;
    metadata?: any;
  }) {
    // Verificar se o usuário destinatário existe
    const payer = await this.prisma.user.findUnique({
      where: { id: data.payerId },
    });

    if (!payer) {
      throw new NotFoundException('Usuário destinatário não encontrado');
    }

    // Criar solicitação de pagamento
    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        requester: {
          connect: { id: data.requesterId }
        },
        payerId: data.payerId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category,
        status: RequestStatus.PENDING,
        expiresAt: data.expiresAt,
        metadata: data.metadata,
      },
    });

    // Notificar usuário destinatário
    await this.notificationsService.createNotification({
      userId: data.payerId,
      type: NotificationType.PAYMENT_REQUEST,
      title: 'Nova Solicitação de Pagamento',
      message: `Você recebeu uma solicitação de pagamento de ${data.amount} ${data.currency}`,
      data: { paymentRequestId: paymentRequest.id },
    });

    return paymentRequest;
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

    return {
      paymentRequests,
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

    return {
      paymentRequests,
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

    return paymentRequest;
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

    return updatedRequest;
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

    return updatedRequest;
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

    return updatedRequest;
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

    return {
      paymentRequests,
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
}
