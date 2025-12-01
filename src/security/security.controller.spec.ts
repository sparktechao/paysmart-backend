import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { Request } from 'express';

describe('SecurityController', () => {
  let controller: SecurityController;
  let service: SecurityService;

  const mockUserId = 'user-123';
  const mockRequest = { user: { id: mockUserId } } as unknown as Request;

  const mockSecurityService = {
    getFraudDetection: jest.fn(),
    reportFraud: jest.fn(),
    getSecurityLogs: jest.fn(),
    lockAccount: jest.fn(),
    unlockAccount: jest.fn(),
    getSecurityAnalytics: jest.fn(),
    getSuspiciousActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [{ provide: SecurityService, useValue: mockSecurityService }],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
    service = module.get<SecurityService>(SecurityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFraudDetection', () => {
    it('should return fraud detection data', async () => {
      const mockData = { riskScore: 25, alerts: [] };
      mockSecurityService.getFraudDetection.mockResolvedValue(mockData);

      const result = await controller.getFraudDetection(mockRequest);

      expect(result).toEqual(mockData);
      expect(service.getFraudDetection).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('reportFraud', () => {
    it('should report fraud successfully', async () => {
      const reportDto = {
        targetUserId: 'user-456',
        description: 'Suspicious transaction',
        category: 'TRANSACTION_FRAUD',
      };
      mockSecurityService.reportFraud.mockResolvedValue({ id: 'report-123' });

      const result = await controller.reportFraud(mockRequest, reportDto as any);

      expect(result).toBeDefined();
      expect(service.reportFraud).toHaveBeenCalledWith(mockUserId, reportDto);
    });
  });

  describe('getSecurityLogs', () => {
    it('should return security logs', async () => {
      const mockLogs = { logs: [], total: 0 };
      mockSecurityService.getSecurityLogs.mockResolvedValue(mockLogs);

      const result = await controller.getSecurityLogs(mockRequest, {}, 1, 10);

      expect(result).toEqual(mockLogs);
      expect(service.getSecurityLogs).toHaveBeenCalledWith(mockUserId, {}, 1, 10);
    });
  });

  describe('lockAccount', () => {
    it('should lock account', async () => {
      const lockDto = { userId: 'user-456', reason: 'Suspicious activity' };
      mockSecurityService.lockAccount.mockResolvedValue({ message: 'Account locked' });

      const result = await controller.lockAccount(lockDto as any);

      expect(result.message).toContain('locked');
      expect(service.lockAccount).toHaveBeenCalledWith(lockDto);
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account', async () => {
      const unlockDto = { userId: 'user-456' };
      mockSecurityService.unlockAccount.mockResolvedValue({ message: 'Account unlocked' });

      const result = await controller.unlockAccount(unlockDto as any);

      expect(result.message).toContain('unlocked');
      expect(service.unlockAccount).toHaveBeenCalledWith(unlockDto);
    });
  });
});
