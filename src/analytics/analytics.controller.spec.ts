import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Request } from 'express';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockUserId = 'user-123';
  const mockRequest = { user: { id: mockUserId } } as unknown as Request;

  const mockAnalyticsService = {
    getDashboard: jest.fn(),
    getTransactionAnalytics: jest.fn(),
    getUserAnalytics: jest.fn(),
    getRevenueAnalytics: jest.fn(),
    getGrowthAnalytics: jest.fn(),
    exportAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      const mockDashboard = { totalTransactions: 100, totalRevenue: 50000 };
      mockAnalyticsService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard(mockRequest, {});

      expect(result).toEqual(mockDashboard);
      expect(service.getDashboard).toHaveBeenCalledWith(mockUserId, {});
    });
  });

  describe('getTransactionAnalytics', () => {
    it('should return transaction analytics', async () => {
      const mockAnalytics = { total: 100, byType: {} };
      mockAnalyticsService.getTransactionAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getTransactionAnalytics(mockRequest, {});

      expect(result).toEqual(mockAnalytics);
      expect(service.getTransactionAnalytics).toHaveBeenCalledWith(mockUserId, {});
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics', async () => {
      const mockAnalytics = { activeUsers: 50, newUsers: 10 };
      mockAnalyticsService.getUserAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getUserAnalytics(mockRequest, {});

      expect(result).toEqual(mockAnalytics);
      expect(service.getUserAnalytics).toHaveBeenCalledWith(mockUserId, {});
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should return revenue analytics', async () => {
      const mockAnalytics = { totalRevenue: 100000, monthlyRevenue: [] };
      mockAnalyticsService.getRevenueAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getRevenueAnalytics(mockRequest, {});

      expect(result).toEqual(mockAnalytics);
      expect(service.getRevenueAnalytics).toHaveBeenCalledWith(mockUserId, {});
    });
  });

  describe('getGrowthAnalytics', () => {
    it('should return growth analytics', async () => {
      const mockAnalytics = { growthRate: 15, trend: 'UP' };
      mockAnalyticsService.getGrowthAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getGrowthAnalytics(mockRequest, {});

      expect(result).toEqual(mockAnalytics);
      expect(service.getGrowthAnalytics).toHaveBeenCalledWith(mockUserId, {});
    });
  });
});
