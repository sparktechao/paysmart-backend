import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('RewardsService', () => {
  let service: RewardsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    reward: { findMany: jest.fn(), create: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    wallet: { findFirst: jest.fn() },
    badge: { findMany: jest.fn() },
    userBadge: { create: jest.fn(), findMany: jest.fn() },
    rewardHistory: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: TransactionsService, useValue: mockTransactionsService },
      ],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserRewards', () => {
    it('should return user rewards', async () => {
      const mockUser = { id: 'user-123', rewardPoints: 1000, level: 5 };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.userBadge.findMany.mockResolvedValue([]);

      const result = await service.getUserRewards('user-123');

      expect(result).toBeDefined();
      expect(result.totalPoints).toBe(1000);
      expect(prisma.user.findUnique).toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard', async () => {
      const mockUsers = [
        { id: 'user-1', firstName: 'John', rewardPoints: 5000 },
        { id: 'user-2', firstName: 'Jane', rewardPoints: 3000 },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getLeaderboard(10);

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('getAvailableBadges', () => {
    it('should return available badges', async () => {
      const result = await service.getAvailableBadges();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUserPoints', () => {
    it('should return user points', async () => {
      const mockUser = { id: 'user-123', rewardPoints: 1000, level: 5 };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserPoints('user-123');

      expect(result.totalPoints).toBe(1000);
      expect(result.level).toBe(5);
    });
  });

  describe('redeemReward', () => {
    it('should redeem reward successfully', async () => {
      const mockUser = { id: 'user-123', rewardPoints: 1000 };
      const mockReward = { id: 'reward-1', pointsCost: 500 };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.reward.findMany.mockResolvedValue([mockReward]);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, rewardPoints: 500 });
      mockPrismaService.reward.findFirst.mockResolvedValue({ id: 'reward-1', claimed: false });
      mockPrismaService.reward.update.mockResolvedValue({});
      mockPrismaService.wallet.findFirst.mockResolvedValue({ id: 'wallet-1' });

      const dto = { rewardId: 'reward-1', points: 500 };

      const result = await service.redeemReward('user-123', dto as any);

      expect(result.message).toContain('resgatada');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockPrismaService.reward.update).toHaveBeenCalled();
    });
  });

  describe('getRewardHistory', () => {
    it('should return reward history', async () => {
      mockPrismaService.reward.findMany.mockResolvedValue([]);
      mockPrismaService.reward.count.mockResolvedValue(0);

      const result = await service.getRewardHistory('user-123', {}, 1, 10);

      expect(result).toBeDefined();
      expect(result.rewards).toEqual([]);
      expect(mockPrismaService.reward.findMany).toHaveBeenCalled();
    });
  });
});
