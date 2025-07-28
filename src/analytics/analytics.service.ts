import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string, filter: any) {
    const period = filter?.period || 'month';
    const startDate = this.getStartDate(period);
    const endDate = new Date();

    const transactionStats = await this.getTransactionAnalyticsInternal(userId, startDate, endDate);
    
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalTransactions: transactionStats.totalTransactions || 0,
      totalRevenue: 0,
      averageTransactionValue: transactionStats.totalTransactions > 0 ? (transactionStats.totalSent + transactionStats.totalReceived) / transactionStats.totalTransactions : 0,
      growthRate: 0,
      topServices: [],
      recentActivity: [],
    };
  }

  async getUserAnalytics(_userId: string, _filter: any) {
    return {
      totalUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0,
      usersByStatus: [],
      usersByPeriod: [],
      topUsers: [],
    };
  }

  async getSystemAnalytics(period: 'day' | 'week' | 'month' = 'week') {
    const startDate = this.getStartDate(period);
    const endDate = new Date();

    return {
      period,
      startDate,
      endDate,
      userStats: {},
      transactionStats: {},
      revenueStats: {},
      serviceStats: {},
    };
  }

  async generateUserReport(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    const analytics = await this.getUserAnalytics(userId, period);
    
    // Salvar relatório no banco
    const report = await this.prisma.analytics.create({
      data: {
        userId,
        type: 'USER_STATS',
        data: analytics,
        period: period.toUpperCase(),
      },
    });

    return {
      reportId: report.id,
      analytics,
      generatedAt: report.createdAt,
    };
  }

  async getRevenueAnalytics(_userId: string, _filter: any) {
    return {
      totalRevenue: 0,
      revenueByPeriod: [],
      revenueByService: [],
      growthRate: 0,
      revenueGrowth: 0,
      averageRevenuePerUser: 0,
      revenueByCurrency: [],
    };
  }

  async getGrowthAnalytics(_userId: string, _filter: any) {
    return {
      userGrowth: 0,
      transactionGrowth: 0,
      revenueGrowth: 0,
      growthTrends: [],
      retentionRate: 0,
      churnRate: 0,
      growthByPeriod: [],
    };
  }

  async getEngagementAnalytics(_userId: string, _filter: any) {
    return {
      activeUsers: 0,
      engagementRate: 0,
      retentionRate: 0,
      userActivity: [],
    };
  }

  async getRealTimeAnalytics(_userId: string) {
    return {
      activeUsers: 0,
      currentTransactions: 0,
      systemStatus: 'healthy',
      lastUpdate: new Date(),
    };
  }

  async getTrends(_userId: string, _filter: any) {
    return {
      trends: [],
      predictions: [],
      insights: [],
    };
  }

  async getComparison(_userId: string, _period1: string, _period2: string, _filter: any) {
    return {
      period1: {},
      period2: {},
      comparison: {},
    };
  }

  async exportAnalytics(_userId: string, _exportAnalyticsDto: any) {
    return {
      downloadUrl: 'https://example.com/export.csv',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async getKPIs(_userId: string, _filter: any) {
    return {
      totalUsers: 0,
      totalTransactions: 0,
      totalRevenue: 0,
      averageTransactionValue: 0,
    };
  }

  async getPredictions(_userId: string, _filter: any) {
    return {
      predictions: [],
      confidence: 0,
      factors: [],
    };
  }

  async getAnalyticsAlerts(_userId: string) {
    return {
      alerts: [],
      criticalAlerts: 0,
      warnings: 0,
    };
  }

  async generateSystemReport(period: 'day' | 'week' | 'month' = 'week') {
    const analytics = await this.getSystemAnalytics(period);
    
    // Salvar relatório no banco
    const report = await this.prisma.analytics.create({
      data: {
        type: 'SYSTEM_STATS',
        data: analytics,
        period: period.toUpperCase(),
      },
    });

    return {
      reportId: report.id,
      analytics,
      generatedAt: report.createdAt,
    };
  }

  async getReportHistory(userId?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [reports, total] = await Promise.all([
      this.prisma.analytics.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.analytics.count({ where }),
    ]);

    return {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async generateDailyReports() {
    console.log('Gerando relatórios diários...');
    
    try {
      await this.generateSystemReport('day');
    } catch (error) {
      console.error('Erro ao gerar relatórios diários:', error);
    }
  }

  async generateWeeklyReports() {
    console.log('Gerando relatórios semanais...');
    
    try {
      await this.generateSystemReport('week');
    } catch (error) {
      console.error('Erro ao gerar relatórios semanais:', error);
    }
  }

  async generateMonthlyReports() {
    console.log('Gerando relatórios mensais...');
    
    try {
      await this.generateSystemReport('month');
    } catch (error) {
      console.error('Erro ao gerar relatórios mensais:', error);
    }
  }

  async getTransactionAnalytics(userId: string, filter: any) {
    const period = filter?.period || 'month';
    const startDate = this.getStartDate(period);
    const endDate = new Date();
    
    const result = await this.getTransactionAnalyticsInternal(userId, startDate, endDate);
    
    return {
      totalAmount: result.totalSent + result.totalReceived,
      averageAmount: result.totalTransactions > 0 ? (result.totalSent + result.totalReceived) / result.totalTransactions : 0,
      successRate: 95, // TODO: Implement proper calculation
      transactionsByType: Object.entries(result.byType).map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount,
      })),
      totalTransactions: result.totalTransactions,
      sentTransactions: result.sentTransactions,
      receivedTransactions: result.receivedTransactions,
      totalSent: result.totalSent,
      totalReceived: result.totalReceived,
      netAmount: result.netAmount,
      byDay: result.byDay,
      transactionsByPeriod: [],
      topUsers: [],
    };
  }

  private async getTransactionAnalyticsInternal(userId: string, startDate: Date, endDate: Date) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const sentTransactions = transactions.filter(t => t.fromUserId === userId);
    const receivedTransactions = transactions.filter(t => t.toUserId === userId);

    const totalSent = sentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalReceived = receivedTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Agrupar por tipo
    const byType = transactions.reduce((acc, t) => {
      const key = t.type;
      if (!acc[key]) {
        acc[key] = { count: 0, amount: 0 };
      }
      acc[key].count++;
      acc[key].amount += t.amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Agrupar por dia
    const byDay = this.groupByDay(transactions, 'createdAt');

    return {
      totalTransactions: transactions.length,
      sentTransactions: sentTransactions.length,
      receivedTransactions: receivedTransactions.length,
      totalSent,
      totalReceived,
      netAmount: totalReceived - totalSent,
      byType,
      byDay,
    };
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  private groupByDay(items: any[], dateField: string) {
    const grouped = items.reduce((acc, item) => {
      const date = new Date(item[dateField]).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([date, items]) => ({
      date,
      count: (items as any[]).length,
      amount: (items as any[]).reduce((sum, item) => sum + (item.amount || 0), 0),
    }));
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReportsCron() {
    await this.generateDailyReports();
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generateWeeklyReportsCron() {
    await this.generateWeeklyReports();
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyReportsCron() {
    await this.generateMonthlyReports();
  }
}
