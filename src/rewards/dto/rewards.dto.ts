import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum RewardType {
  POINTS = 'POINTS',
  BADGE = 'BADGE',
  CASHBACK = 'CASHBACK',
  DISCOUNT = 'DISCOUNT',
  FEATURE_UNLOCK = 'FEATURE_UNLOCK'
}

export enum BadgeType {
  FIRST_TRANSACTION = 'FIRST_TRANSACTION',
  VALIDATOR = 'VALIDATOR',
  FREQUENT_USER = 'FREQUENT_USER',
  HIGH_VALUE = 'HIGH_VALUE',
  EARLY_ADOPTER = 'EARLY_ADOPTER',
  COMMUNITY_HELPER = 'COMMUNITY_HELPER'
}

export enum RewardStatus {
  AVAILABLE = 'AVAILABLE',
  REDEEMED = 'REDEEMED',
  EXPIRED = 'EXPIRED',
  LOCKED = 'LOCKED'
}

export class UserRewardsResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  level: number;

  @ApiProperty()
  experience: number;

  @ApiProperty()
  experienceToNextLevel: number;

  @ApiProperty()
  badges: BadgeDto[];

  @ApiProperty()
  availableRewards: RewardDto[];

  @ApiProperty()
  redeemedRewards: RewardDto[];
}

export class BadgeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: BadgeType;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  earnedAt: Date;

  @ApiProperty()
  rarity: string;
}

export class RewardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: RewardType;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  value: number;

  @ApiProperty()
  pointsCost: number;

  @ApiProperty({ enum: RewardStatus })
  status: RewardStatus;

  @ApiProperty()
  expiresAt?: Date;

  @ApiProperty()
  redeemedAt?: Date;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  userEmail: string;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  level: number;

  @ApiProperty()
  rank: number;

  @ApiProperty()
  badgesCount: number;
}

export class RedeemRewardDto {
  @ApiProperty({ description: 'ID da recompensa' })
  @IsString()
  rewardId: string;

  @ApiProperty({ description: 'Quantidade a resgatar', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class RewardHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  rewardId: string;

  @ApiProperty()
  rewardName: string;

  @ApiProperty()
  rewardType: RewardType;

  @ApiProperty()
  pointsSpent: number;

  @ApiProperty()
  value: number;

  @ApiProperty()
  redeemedAt: Date;

  @ApiProperty()
  expiresAt?: Date;
}

export class RewardFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(RewardType)
  type?: RewardType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(RewardStatus)
  status?: RewardStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minPoints?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxPoints?: number;
} 