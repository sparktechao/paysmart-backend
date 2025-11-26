import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountType } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

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
    this.logger.log('Gerando relatórios diários');
    
    try {
      await this.generateSystemReport('day');
      this.logger.log('Relatórios diários gerados com sucesso');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao gerar relatórios diários', errorStack, { error: errorMessage });
    }
  }

  async generateWeeklyReports() {
    this.logger.log('Gerando relatórios semanais');
    
    try {
      await this.generateSystemReport('week');
      this.logger.log('Relatórios semanais gerados com sucesso');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao gerar relatórios semanais', errorStack, { error: errorMessage });
    }
  }

  async generateMonthlyReports() {
    this.logger.log('Gerando relatórios mensais');
    
    try {
      await this.generateSystemReport('month');
      this.logger.log('Relatórios mensais gerados com sucesso');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao gerar relatórios mensais', errorStack, { error: errorMessage });
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

  // Funcionalidades específicas para BUSINESS

  async getBusinessReports(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    // Verificar se o usuário tem carteira BUSINESS
    const businessWallets = await this.prisma.wallet.findMany({
      where: {
        userId,
        accountType: AccountType.BUSINESS,
        status: 'ACTIVE',
      },
    });

    if (businessWallets.length === 0) {
      throw new BadRequestException('Usuário não possui carteira BUSINESS');
    }

    const startDate = this.getStartDate(period);
    const endDate = new Date();

    // Obter transações de todas as carteiras BUSINESS do usuário
    const walletIds = businessWallets.map(w => w.id);
    
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromWalletId: { in: walletIds } },
          { toWalletId: { in: walletIds } },
        ],
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calcular estatísticas
    const totalRevenue = transactions
      .filter(t => walletIds.includes(t.toWalletId || ''))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => walletIds.includes(t.fromWalletId || ''))
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = totalRevenue - totalExpenses;

    // Agrupar por moeda
    const byCurrency = transactions.reduce((acc, t) => {
      const currency = t.currency;
      if (!acc[currency]) {
        acc[currency] = { revenue: 0, expenses: 0, transactions: 0 };
      }
      if (walletIds.includes(t.toWalletId || '')) {
        acc[currency].revenue += t.amount;
      }
      if (walletIds.includes(t.fromWalletId || '')) {
        acc[currency].expenses += t.amount;
      }
      acc[currency].transactions++;
      return acc;
    }, {} as Record<string, { revenue: number; expenses: number; transactions: number }>);

    return {
      period,
      startDate,
      endDate,
      businessWallets: businessWallets.map(w => ({
        id: w.id,
        walletNumber: w.walletNumber,
        companyName: (w.businessInfo as any)?.companyName || 'N/A',
        taxId: (w.businessInfo as any)?.taxId || 'N/A',
      })),
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        totalTransactions: transactions.length,
      },
      byCurrency,
      transactions: transactions.slice(0, 100), // Últimas 100 transações
    };
  }

  async generateBusinessFiscalReport(userId: string, year: number, month?: number) {
    // Verificar se o usuário tem carteira BUSINESS
    const businessWallets = await this.prisma.wallet.findMany({
      where: {
        userId,
        accountType: AccountType.BUSINESS,
        status: 'ACTIVE',
      },
    });

    if (businessWallets.length === 0) {
      throw new BadRequestException('Usuário não possui carteira BUSINESS');
    }

    const startDate = month 
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const endDate = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59);

    const walletIds = businessWallets.map(w => w.id);
    
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromWalletId: { in: walletIds } },
          { toWalletId: { in: walletIds } },
        ],
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
    });

    // Preparar relatório fiscal
    const report = {
      period: month ? `${year}-${String(month).padStart(2, '0')}` : year.toString(),
      businessInfo: businessWallets.map(w => ({
        walletNumber: w.walletNumber,
        companyName: (w.businessInfo as any)?.companyName || 'N/A',
        taxId: (w.businessInfo as any)?.taxId || 'N/A',
        registrationNumber: (w.businessInfo as any)?.registrationNumber || 'N/A',
        businessAddress: (w.businessInfo as any)?.businessAddress || {},
      })),
      transactions: transactions.map(t => ({
        date: t.createdAt,
        reference: t.reference,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        isRevenue: walletIds.includes(t.toWalletId || ''),
        isExpense: walletIds.includes(t.fromWalletId || ''),
      })),
      summary: {
        totalRevenue: transactions
          .filter(t => walletIds.includes(t.toWalletId || ''))
          .reduce((sum, t) => sum + t.amount, 0),
        totalExpenses: transactions
          .filter(t => walletIds.includes(t.fromWalletId || ''))
          .reduce((sum, t) => sum + t.amount, 0),
        totalTransactions: transactions.length,
      },
      generatedAt: new Date(),
    };

    // Salvar relatório
    const savedReport = await this.prisma.analytics.create({
      data: {
        userId,
        type: 'BUSINESS_FISCAL_REPORT',
        data: report,
        period: month ? 'MONTHLY' : 'YEARLY',
      },
    });

    return {
      reportId: savedReport.id,
      report,
    };
  }

  async getBusinessAuthorizedUsers(walletId: string, userId: string) {
    // Verificar se a carteira pertence ao usuário e é BUSINESS
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
        accountType: AccountType.BUSINESS,
      },
    });

    if (!wallet) {
      throw new BadRequestException('Carteira BUSINESS não encontrada');
    }

    const businessInfo = wallet.businessInfo as any;
    const authorizedUserIds = businessInfo?.authorizedUsers || [];

    if (authorizedUserIds.length === 0) {
      return { authorizedUsers: [] };
    }

    const authorizedUsers = await this.prisma.user.findMany({
      where: {
        id: { in: authorizedUserIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
      },
    });

    return { authorizedUsers };
  }

  async addBusinessAuthorizedUser(walletId: string, userId: string, authorizedUserId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
        accountType: AccountType.BUSINESS,
      },
    });

    if (!wallet) {
      throw new BadRequestException('Carteira BUSINESS não encontrada');
    }

    // Verificar se o usuário autorizado existe
    const authorizedUser = await this.prisma.user.findUnique({
      where: { id: authorizedUserId },
    });

    if (!authorizedUser) {
      throw new BadRequestException('Usuário autorizado não encontrado');
    }

    const businessInfo = wallet.businessInfo as any || {};
    const authorizedUsers = businessInfo.authorizedUsers || [];

    if (authorizedUsers.includes(authorizedUserId)) {
      throw new BadRequestException('Usuário já está autorizado');
    }

    // Adicionar usuário autorizado
    const updatedBusinessInfo = {
      ...businessInfo,
      authorizedUsers: [...authorizedUsers, authorizedUserId],
    };

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { businessInfo: updatedBusinessInfo },
    });

    return { message: 'Usuário autorizado adicionado com sucesso' };
  }

  async removeBusinessAuthorizedUser(walletId: string, userId: string, authorizedUserId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
        accountType: AccountType.BUSINESS,
      },
    });

    if (!wallet) {
      throw new BadRequestException('Carteira BUSINESS não encontrada');
    }

    const businessInfo = wallet.businessInfo as any || {};
    const authorizedUsers = businessInfo.authorizedUsers || [];

    if (!authorizedUsers.includes(authorizedUserId)) {
      throw new BadRequestException('Usuário não está autorizado');
    }

    // Remover usuário autorizado
    const updatedBusinessInfo = {
      ...businessInfo,
      authorizedUsers: authorizedUsers.filter((id: string) => id !== authorizedUserId),
    };

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { businessInfo: updatedBusinessInfo },
    });

    return { message: 'Usuário autorizado removido com sucesso' };
  }
}
