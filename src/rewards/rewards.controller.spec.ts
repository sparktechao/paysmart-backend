import { Test, TestingModule } from '@nestjs/testing';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { Request } from 'express';

describe('RewardsController', () => {
  let controller: RewardsController;
  let service: RewardsService;

  const mockUserId = 'user-123';
  const mockRequest = { user: { id: mockUserId } } as unknown as Request;

  const mockRewardsService = {
    getUserRewards: jest.fn(),
    getLeaderboard: jest.fn(),
    getAvailableBadges: jest.fn(),
    getUserPoints: jest.fn(),
    redeemReward: jest.fn(),
    getRewardHistory: jest.fn(),
    claimDailyReward: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [{ provide: RewardsService, useValue: mockRewardsService }],
    }).compile();

    controller = module.get<RewardsController>(RewardsController);
    service = module.get<RewardsService>(RewardsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserRewards', () => {
    it('should return user rewards', async () => {
      const mockRewards = { points: 1000, badges: [], level: 5 };
      mockRewardsService.getUserRewards.mockResolvedValue(mockRewards);

      const result = await controller.getUserRewards(mockRequest);

      expect(result).toEqual(mockRewards);
      expect(service.getUserRewards).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard', async () => {
      const mockLeaderboard = [{ userId: 'user-1', points: 5000, rank: 1 }];
      mockRewardsService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await controller.getLeaderboard(10);

      expect(result).toEqual(mockLeaderboard);
      expect(service.getLeaderboard).toHaveBeenCalledWith(10);
    });
  });

  describe('getAvailableBadges', () => {
    it('should return available badges', async () => {
      const mockBadges = [{ id: 'badge-1', name: 'First Transaction' }];
      mockRewardsService.getAvailableBadges.mockResolvedValue(mockBadges);

      const result = await controller.getAvailableBadges();

      expect(result).toEqual(mockBadges);
      expect(service.getAvailableBadges).toHaveBeenCalled();
    });
  });

  describe('getUserPoints', () => {
    it('should return user points', async () => {
      const mockPoints = { points: 1000, level: 5 };
      mockRewardsService.getUserPoints.mockResolvedValue(mockPoints);

      const result = await controller.getUserPoints(mockRequest);

      expect(result).toEqual(mockPoints);
      expect(service.getUserPoints).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('redeemReward', () => {
    it('should redeem reward successfully', async () => {
      const redeemDto = { rewardId: 'reward-123', points: 500 };
      mockRewardsService.redeemReward.mockResolvedValue({ message: 'Reward redeemed' });

      const result = await controller.redeemReward(mockRequest, redeemDto as any);

      expect(result.message).toContain('redeemed');
      expect(service.redeemReward).toHaveBeenCalledWith(mockUserId, redeemDto);
    });
  });

  describe('getRewardHistory', () => {
    it('should return reward history', async () => {
      const mockHistory = { rewards: [], total: 0 };
      mockRewardsService.getRewardHistory.mockResolvedValue(mockHistory);

      const result = await controller.getRewardHistory(mockRequest, {}, 1, 10);

      expect(result).toEqual(mockHistory);
      expect(service.getRewardHistory).toHaveBeenCalledWith(mockUserId, {}, 1, 10);
    });
  });
});
