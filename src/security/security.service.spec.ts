import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getQueueToken } from '@nestjs/bull';

describe('SecurityService', () => {
  let service: SecurityService;

  const mockPrismaService = {
    fraudReport: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    securityLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { update: jest.fn(), findUnique: jest.fn() },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: getQueueToken('security-queue'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFraudDetection', () => {
    it('should return fraud detection data', async () => {
      const result = await service.getFraudDetection('user-123');

      expect(result).toBeDefined();
      expect(result.fraudScore).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.suspiciousActivities).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('reportFraud', () => {
    it('should create fraud report', async () => {
      const dto = {
        targetUserId: 'user-456',
        description: 'Suspicious activity',
        category: 'TRANSACTION_FRAUD',
      };

      const result = await service.reportFraud('user-123', dto as any);

      expect(result).toBeDefined();
      expect(result.id).toBe('mock-report-id');
      expect(result.reporterId).toBe('user-123');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getSecurityLogs', () => {
    it('should return security logs', async () => {
      mockPrismaService.securityLog.findMany.mockResolvedValue([]);
      mockPrismaService.securityLog.count.mockResolvedValue(0);

      const result = await service.getSecurityLogs('user-123', {}, 1, 10);

      expect(result).toBeDefined();
      expect(result.logs).toEqual([]);
    });
  });

  describe('lockAccount', () => {
    it('should lock account', async () => {
      const dto = { userId: 'user-123', reason: 'Suspicious activity' };

      const result = await service.lockAccount(dto as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('bloqueada');
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account', async () => {
      const dto = { userId: 'user-123' };

      const result = await service.unlockAccount(dto as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('desbloqueada');
    });
  });
});
