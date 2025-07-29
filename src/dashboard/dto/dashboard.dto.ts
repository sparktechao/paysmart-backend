import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    userType: string;
    status: string;
  };

  @ApiProperty({ required: false })
  defaultWallet?: {
    id: string;
    walletNumber: string;
    balances: Record<string, number>;
    limits: Record<string, any>;
    status: string;
  };

  @ApiProperty()
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    status: string;
    createdAt: Date;
  }>;

  @ApiProperty()
  quickStats: {
    totalBalance: number;
    totalWallets: number;
    pendingValidations: number;
    unreadNotifications: number;
  };
}

export class DashboardChartsDto {
  @ApiProperty()
  balanceEvolution: Array<{
    date: string;
    balance: number;
  }>;

  @ApiProperty()
  transactionTypes: Array<{
    type: string;
    count: number;
    amount: number;
  }>;

  @ApiProperty()
  monthlySummary: {
    inflows: number;
    outflows: number;
    netChange: number;
  };
}

export class QuickActionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  route: string;

  @ApiProperty()
  description?: string;
}

export class DashboardChartsQueryDto {
  @ApiProperty({ required: false, description: 'Período: week, month, year' })
  period?: string;

  @ApiProperty({ required: false, description: 'Data de início (ISO)' })
  startDate?: string;

  @ApiProperty({ required: false, description: 'Data de fim (ISO)' })
  endDate?: string;
}