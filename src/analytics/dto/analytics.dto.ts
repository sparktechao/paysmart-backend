import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum AnalyticsPeriod {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

export enum AnalyticsType {
  TRANSACTIONS = 'TRANSACTIONS',
  USERS = 'USERS',
  REVENUE = 'REVENUE',
  GROWTH = 'GROWTH',
  ENGAGEMENT = 'ENGAGEMENT'
}

export class DashboardResponseDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  totalTransactions: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  averageTransactionValue: number;

  @ApiProperty()
  growthRate: number;

  @ApiProperty()
  topServices: any[];

  @ApiProperty()
  recentActivity: any[];
}

export class TransactionAnalyticsDto {
  @ApiProperty()
  totalTransactions: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  averageAmount: number;

  @ApiProperty()
  successRate: number;

  @ApiProperty()
  transactionsByType: any[];

  @ApiProperty()
  transactionsByPeriod: any[];

  @ApiProperty()
  topUsers: any[];
}

export class UserAnalyticsDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  newUsers: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  verifiedUsers: number;

  @ApiProperty()
  usersByStatus: any[];

  @ApiProperty()
  usersByPeriod: any[];

  @ApiProperty()
  topUsers: any[];
}

export class RevenueAnalyticsDto {
  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  revenueGrowth: number;

  @ApiProperty()
  averageRevenuePerUser: number;

  @ApiProperty()
  revenueByService: any[];

  @ApiProperty()
  revenueByPeriod: any[];

  @ApiProperty()
  revenueByCurrency: any[];
}

export class GrowthAnalyticsDto {
  @ApiProperty()
  userGrowth: number;

  @ApiProperty()
  transactionGrowth: number;

  @ApiProperty()
  revenueGrowth: number;

  @ApiProperty()
  retentionRate: number;

  @ApiProperty()
  churnRate: number;

  @ApiProperty()
  growthByPeriod: any[];
}

export class AnalyticsFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class ExportAnalyticsDto {
  @ApiProperty({ description: 'Tipo de analytics', enum: AnalyticsType })
  @IsEnum(AnalyticsType)
  type: AnalyticsType;

  @ApiProperty({ description: 'Formato de exportação' })
  @IsString()
  format: 'csv' | 'pdf' | 'excel';

  @ApiProperty({ description: 'Filtros', required: false })
  @IsOptional()
  filters?: AnalyticsFilterDto;
} 