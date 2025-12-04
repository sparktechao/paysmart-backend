import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto, NotificationResponseDto } from './dto/notifications.dto';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    @InjectQueue('notification-queue') private notificationQueue: Queue,
  ) {}

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
    // Validar se o usuário existe antes de criar a notificação
    const user = await this.prisma.user.findUnique({
      where: { id: createNotificationDto.userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error(`Usuário com ID ${createNotificationDto.userId} não encontrado`);
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: createNotificationDto.userId,
        type: createNotificationDto.type,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        data: createNotificationDto.data,
        status: 'PENDING',
      },
    });

    // Enviar notificação em tempo real via Socket.io
    try {
      this.notificationsGateway.sendNotification(createNotificationDto.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
      });
      console.log(`📤 Notificação enviada via WebSocket para userId: ${createNotificationDto.userId}`, {
        notificationId: notification.id,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      console.warn('Erro ao enviar notificação via WebSocket (não crítico)', error);
    }

    // Adicionar à fila para processamento assíncrono (email, SMS, push)
    // Tratar erro graciosamente se a fila não estiver disponível
    try {
      await this.notificationQueue.add('send-notification', {
        notificationId: notification.id,
        userId: createNotificationDto.userId,
        type: createNotificationDto.type,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        data: createNotificationDto.data,
      });
    } catch (error) {
      // Log do erro mas não falha a criação da notificação
      console.warn('Erro ao adicionar notificação à fila:', error);
    }

    return this.mapToNotificationResponse(notification);
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    return {
      notifications: notifications.map(this.mapToNotificationResponse),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return this.mapToNotificationResponse(updatedNotification);
  }

  async markAllAsRead(userId: string): Promise<{ message: string }> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        status: 'SENT',
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return { message: 'Todas as notificações foram marcadas como lidas' };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        status: {
          in: ['PENDING', 'SENT'],
        },
      },
    });

    return { count };
  }

  async deleteNotification(notificationId: string, userId: string): Promise<{ message: string }> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notificação excluída com sucesso' };
  }

  async sendBulkNotification(userIds: string[], notificationData: Omit<CreateNotificationDto, 'userId'>): Promise<{ message: string }> {
    const notifications = await Promise.all(
      userIds.map(userId =>
        this.createNotification({
          userId,
          ...notificationData,
        })
      )
    );

    return { message: `${notifications.length} notificações enviadas com sucesso` };
  }

  private mapToNotificationResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      status: notification.status,
      readAt: notification.readAt,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
    };
  }
} 