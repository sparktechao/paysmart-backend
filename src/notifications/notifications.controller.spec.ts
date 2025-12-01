import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto } from './dto/notifications.dto';
import { NotificationType } from '@prisma/client';
import { Request } from 'express';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockUserId = 'user-123';
  const mockNotificationId = 'notification-123';

  const mockRequest = {
    user: { id: mockUserId },
  } as unknown as Request;

  const mockNotification: NotificationResponseDto = {
    id: mockNotificationId,
    userId: mockUserId,
    type: NotificationType.PAYMENT_RECEIVED,
    title: 'New Transaction',
    message: 'You received 5000 AOA',
    data: { transactionId: 'tx-123' },
    status: 'SENT',
    readAt: null,
    createdAt: new Date('2024-01-01'),
  };

  const mockNotificationsService = {
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    sendBulkNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockResponse = {
        notifications: [mockNotification],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      mockNotificationsService.getUserNotifications.mockResolvedValue(mockResponse);

      const result = await controller.getUserNotifications(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(service.getUserNotifications).toHaveBeenCalledWith(mockUserId, 1, 20);
    });

    it('should return notifications with custom pagination', async () => {
      const mockResponse = {
        notifications: [mockNotification],
        total: 50,
        page: 2,
        totalPages: 5,
      };
      mockNotificationsService.getUserNotifications.mockResolvedValue(mockResponse);

      await controller.getUserNotifications(mockRequest, 2, 10);

      expect(service.getUserNotifications).toHaveBeenCalledWith(mockUserId, 2, 10);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue({ count: 5 });

      const result = await controller.getUnreadCount(mockRequest);

      expect(result.count).toBe(5);
      expect(service.getUnreadCount).toHaveBeenCalledWith(mockUserId);
    });

    it('should return zero when no unread notifications', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue({ count: 0 });

      const result = await controller.getUnreadCount(mockRequest);

      expect(result.count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const readNotification = { ...mockNotification, readAt: new Date(), status: 'READ' };
      mockNotificationsService.markAsRead.mockResolvedValue(readNotification);

      const result = await controller.markAsRead(mockRequest, mockNotificationId);

      expect(result.readAt).toBeDefined();
      expect(service.markAsRead).toHaveBeenCalledWith(mockNotificationId, mockUserId);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({
        message: '5 notificações marcadas como lidas',
      });

      const result = await controller.markAllAsRead(mockRequest);

      expect(result.message).toContain('5 notificações marcadas como lidas');
      expect(service.markAllAsRead).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockNotificationsService.deleteNotification.mockResolvedValue({
        message: 'Notificação excluída com sucesso',
      });

      const result = await controller.deleteNotification(mockRequest, mockNotificationId);

      expect(result.message).toContain('excluída com sucesso');
      expect(service.deleteNotification).toHaveBeenCalledWith(mockNotificationId, mockUserId);
    });
  });

  describe('sendBulkNotification', () => {
    it('should send bulk notifications', async () => {
      const data = {
        userIds: ['user-1', 'user-2', 'user-3'],
        notification: {
          type: NotificationType.PAYMENT_RECEIVED,
          title: 'System Update',
          message: 'System will be updated tonight',
        },
      };
      mockNotificationsService.sendBulkNotification.mockResolvedValue({
        message: '3 notificações enviadas',
      });

      const result = await controller.sendBulkNotification(data);

      expect(result.message).toContain('3 notificações enviadas');
      expect(service.sendBulkNotification).toHaveBeenCalledWith(
        data.userIds,
        expect.objectContaining({
          type: data.notification.type,
          title: data.notification.title,
          message: data.notification.message,
        })
      );
    });
  });
});
