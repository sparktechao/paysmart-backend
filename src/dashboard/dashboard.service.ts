import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardSummaryDto, DashboardChartsDto, QuickActionDto, DashboardChartsQueryDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary(userId: string): Promise<DashboardSummaryDto> {
    // Buscar usuário
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        userType: true,
        status: true,
      },
    });

    // Buscar carteira padrão
    const defaultWallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        isDefault: true,
      },
      select: {
        id: true,
        walletNumber: true,
        balances: true,
        limits: true,
        status: true,
      },
    });

    // Buscar transações recentes (últimas 5)
    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    // Calcular estatísticas rápidas
    const [totalWallets, pendingValidations, unreadNotifications] = await Promise.all([
      this.prisma.wallet.count({ where: { userId } }),
      this.prisma.validation.count({ 
        where: { 
          validatorId: userId, 
          status: 'PENDING' 
        } 
      }),
      this.prisma.notification.count({ 
        where: { 
          userId, 
          status: 'PENDING' 
        } 
      }),
    ]);

    // Calcular saldo total
    const totalBalance = defaultWallet 
      ? Object.values(defaultWallet.balances as Record<string, number>).reduce((sum, balance) => sum + balance, 0)
      : 0;

    return {
      user,
      defaultWallet: defaultWallet ? {
        id: defaultWallet.id,
        walletNumber: defaultWallet.walletNumber,
        balances: defaultWallet.balances as Record<string, number>,
        limits: defaultWallet.limits as Record<string, any>,
        status: defaultWallet.status,
      } : null,
      recentTransactions,
      quickStats: {
        totalBalance,
        totalWallets,
        pendingValidations,
        unreadNotifications,
      },
    };
  }

  async getDashboardCharts(userId: string, query: DashboardChartsQueryDto): Promise<DashboardChartsDto> {
    const { period = 'month', startDate, endDate } = query;

    // Calcular datas baseadas no período
    let start: Date;
    let end: Date = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case 'week':
          start = new Date();
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start = new Date();
          start.setMonth(start.getMonth() - 1);
          break;
        case 'year':
          start = new Date();
          start.setFullYear(start.getFullYear() - 1);
          break;
        default:
          start = new Date();
          start.setMonth(start.getMonth() - 1);
      }
    }

    // Buscar transações do período
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        type: true,
        amount: true,
        currency: true,
        createdAt: true,
      },
    });

    // Calcular evolução do saldo
    const balanceEvolution = this.calculateBalanceEvolution(transactions, start, end);

    // Calcular tipos de transação
    const transactionTypes = this.calculateTransactionTypes(transactions);

    // Calcular resumo mensal
    const monthlySummary = this.calculateMonthlySummary(transactions);

    return {
      balanceEvolution,
      transactionTypes,
      monthlySummary,
    };
  }

  async getQuickActions(userId: string): Promise<QuickActionDto[]> {
    // Buscar tipo de usuário para personalizar ações
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });

    const baseActions: QuickActionDto[] = [
      {
        id: 'transfer',
        title: 'Transferir',
        icon: 'send',
        route: '/transfer',
        description: 'Enviar dinheiro para outros usuários',
      },
      {
        id: 'deposit',
        title: 'Depositar',
        icon: 'plus',
        route: '/deposit',
        description: 'Adicionar dinheiro à carteira',
      },
      {
        id: 'withdraw',
        title: 'Levantar',
        icon: 'minus',
        route: '/withdraw',
        description: 'Levantar dinheiro da carteira',
      },
      {
        id: 'services',
        title: 'Serviços',
        icon: 'services',
        route: '/services',
        description: 'Pagar serviços e contas',
      },
      {
        id: 'wallets',
        title: 'Carteiras',
        icon: 'wallet',
        route: '/wallets',
        description: 'Gerir carteiras',
      },
    ];

    // Adicionar ações específicas para usuários premium
    if (user?.userType === 'PREMIUM') {
      baseActions.push({
        id: 'validations',
        title: 'Validações',
        icon: 'check',
        route: '/validations',
        description: 'Validar novos usuários',
      });
    }

    // Adicionar ações específicas para admins
    if (user?.userType === 'ADMIN') {
      baseActions.push({
        id: 'admin',
        title: 'Admin',
        icon: 'settings',
        route: '/admin',
        description: 'Painel administrativo',
      });
    }

    return baseActions;
  }

  private calculateBalanceEvolution(transactions: any[], start: Date, end: Date): Array<{ date: string; balance: number }> {
    const evolution: Array<{ date: string; balance: number }> = [];
    let currentBalance = 0;

    // Agrupar transações por data
    const transactionsByDate = new Map<string, number>();
    
    transactions.forEach(tx => {
      const date = tx.createdAt.toISOString().split('T')[0];
      const amount = tx.currency === 'AOA' ? tx.amount : tx.amount * 1000; // Converter para AOA
      
      if (tx.type === 'DEPOSIT' || (tx.type === 'TRANSFER' && tx.toUserId)) {
        transactionsByDate.set(date, (transactionsByDate.get(date) || 0) + amount);
      } else if (tx.type === 'WITHDRAWAL' || (tx.type === 'TRANSFER' && tx.fromUserId)) {
        transactionsByDate.set(date, (transactionsByDate.get(date) || 0) - amount);
      }
    });

    // Gerar pontos de evolução
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dailyChange = transactionsByDate.get(dateStr) || 0;
      currentBalance += dailyChange;
      
      evolution.push({
        date: dateStr,
        balance: currentBalance,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return evolution;
  }

  private calculateTransactionTypes(transactions: any[]): Array<{ type: string; count: number; amount: number }> {
    const typeMap = new Map<string, { count: number; amount: number }>();

    transactions.forEach(tx => {
      const amount = tx.currency === 'AOA' ? tx.amount : tx.amount * 1000;
      
      if (!typeMap.has(tx.type)) {
        typeMap.set(tx.type, { count: 0, amount: 0 });
      }
      
      const current = typeMap.get(tx.type)!;
      current.count += 1;
      current.amount += Math.abs(amount);
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      amount: data.amount,
    }));
  }

  private calculateMonthlySummary(transactions: any[]): { inflows: number; outflows: number; netChange: number } {
    let inflows = 0;
    let outflows = 0;

    transactions.forEach(tx => {
      const amount = tx.currency === 'AOA' ? tx.amount : tx.amount * 1000;
      
      if (tx.type === 'DEPOSIT' || (tx.type === 'TRANSFER' && tx.toUserId)) {
        inflows += amount;
      } else if (tx.type === 'WITHDRAWAL' || (tx.type === 'TRANSFER' && tx.fromUserId)) {
        outflows += amount;
      }
    });

    return {
      inflows,
      outflows,
      netChange: inflows - outflows,
    };
  }
}