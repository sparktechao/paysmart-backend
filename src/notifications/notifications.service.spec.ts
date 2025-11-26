import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { getQueueToken } from '@nestjs/bull';
import {
  CreateNotificationDto,
} from './dto/notifications.dto';
import { NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  let gateway: NotificationsGateway;
  let queue: any;

  const mockUserId = 'user-123';
  const mockNotificationId = 'notification-123';

  const mockNotification = {
    id: mockNotificationId,
    userId: mockUserId,
    type: NotificationType.PAYMENT_RECEIVED,
    title: 'New Transaction',
    message: 'You received 5000 AOA',
    data: { transactionId: 'tx-123' },
    status: 'PENDING',
    isRead: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockGateway = {
    sendNotification: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsGateway,
          useValue: mockGateway,
        },
        {
          provide: getQueueToken('notification-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    queue = mockQueue;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    const createDto: CreateNotificationDto = {
      userId: mockUserId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'New Transaction',
      message: 'You received 5000 AOA',
      data: { transactionId: 'tx-123' },
    };

    it('should create notification and send via gateway and queue', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockQueue.add.mockResolvedValue({});

      const result = await service.createNotification(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockNotificationId);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: createDto.userId,
          type: createDto.type,
          title: createDto.title,
          message: createDto.message,
          data: createDto.data,
          status: 'PENDING',
        },
      });
      expect(gateway.sendNotification).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          id: mockNotificationId,
          type: createDto.type,
        })
      );
      expect(queue.add).toHaveBeenCalledWith(
        'send-notification',
        expect.objectContaining({
          notificationId: mockNotificationId,
          userId: mockUserId,
        })
      );
    });

    it('should create notification with custom data', async () => {
      const customDto = {
        ...createDto,
        data: { custom: 'data', amount: 10000 },
      };
      const customNotification = { ...mockNotification, data: customDto.data };
      mockPrismaService.notification.create.mockResolvedValue(
        customNotification
      );

      const result = await service.createNotification(customDto);

      expect(result.data).toEqual(customDto.data);
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [mockNotification];
      mockPrismaService.notification.findMany.mockResolvedValue(
        mockNotifications
      );
      mockPrismaService.notification.count.mockResolvedValue(1);

      const result = await service.getUserNotifications(mockUserId, 1, 20);

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should return paginated notifications for page 2', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(25);

      const result = await service.getUserNotifications(mockUserId, 2, 10);

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('should handle empty notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUserNotifications(mockUserId);

      expect(result.notifications).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const readNotification = { ...mockNotification, readAt: new Date(), status: 'READ' };
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue(readNotification);

      const result = await service.markAsRead(mockNotificationId, mockUserId);

      expect(result.readAt).toBeDefined();
      expect(mockPrismaService.notification.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({
        count: 5,
      });

      const result = await service.markAllAsRead(mockUserId);

      expect(result.message).toContain('Todas as notificações foram marcadas como lidas');
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'SENT' },
        data: { status: 'READ', readAt: expect.any(Date) },
      });
    });

    it('should handle case with no unread notifications', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await service.markAllAsRead(mockUserId);

      expect(result.message).toContain('Todas as notificações foram marcadas como lidas');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId);

      expect(result.count).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: { in: ['PENDING', 'SENT'] } },
      });
    });

    it('should return zero when no unread notifications', async () => {
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUserId);

      expect(result.count).toBe(0);
    });
  });
});
