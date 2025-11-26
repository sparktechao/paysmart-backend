import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    transaction: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    user: { count: jest.fn(), findMany: jest.fn() },
    wallet: { findMany: jest.fn(), aggregate: jest.fn() },
    paymentRequest: { count: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(100);
      mockPrismaService.transaction.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.wallet.aggregate.mockResolvedValue({ _sum: { balance: 100000 } });

      const result = await service.getDashboard('user-123', {});

      expect(result).toBeDefined();
      expect(result.totalTransactions).toBe(0);
    });
  });

  describe('getTransactionAnalytics', () => {
    it('should return transaction analytics', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(100);
      mockPrismaService.transaction.groupBy.mockResolvedValue([]);
      mockPrismaService.transaction.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });

      const result = await service.getTransactionAnalytics('user-123', {});

      expect(result).toBeDefined();
      expect(result.totalTransactions).toBe(0);
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics', async () => {
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getUserAnalytics('user-123', {});

      expect(result).toBeDefined();
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should return revenue analytics', async () => {
      const result = await service.getRevenueAnalytics('user-123', {});

      expect(result).toBeDefined();
      expect(result.totalRevenue).toBe(0); // Método mockado retorna 0
      expect(result.revenueByPeriod).toEqual([]);
      expect(result.revenueByService).toEqual([]);
    });
  });

  describe('getGrowthAnalytics', () => {
    it('should return growth analytics', async () => {
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.transaction.count.mockResolvedValue(100);

      const result = await service.getGrowthAnalytics('user-123', {});

      expect(result).toBeDefined();
    });
  });
});
