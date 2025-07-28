import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RewardType, Currency } from '@prisma/client';

@Injectable()
export class RewardsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
  ) {}

  async createReward(data: {
    userId: string;
    type: RewardType;
    amount: number;
    currency: Currency;
    description: string;
    metadata?: any;
    expiresAt?: Date;
  }) {
    const reward = await this.prisma.reward.create({
      data: {
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        metadata: data.metadata,
        expiresAt: data.expiresAt,
        claimed: false,
      },
    });

    // Notificar usuário sobre nova recompensa
    await this.notificationsService.createNotification({
      userId: data.userId,
      type: 'VALIDATION_REWARD',
      title: 'Nova Recompensa Disponível',
      message: `Você ganhou ${data.amount} ${data.currency} - ${data.description}`,
      data: {
        rewardId: reward.id,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
      },
    });

    return reward;
  }

  async claimReward(rewardId: string, userId: string) {
    const reward = await this.prisma.reward.findFirst({
      where: {
        id: rewardId,
        userId,
        claimed: false,
      },
    });

    if (!reward) {
      throw new NotFoundException('Recompensa não encontrada ou já reclamada');
    }

    // Verificar se a recompensa expirou
    if (reward.expiresAt && reward.expiresAt < new Date()) {
      throw new BadRequestException('Recompensa expirada');
    }

    // Buscar carteira padrão do usuário
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira padrão não encontrada');
    }

    try {
      // Marcar recompensa como reclamada
      await this.prisma.reward.update({
        where: { id: rewardId },
        data: {
          claimed: true,
          claimedAt: new Date(),
        },
      });

      // Adicionar valor à carteira
      await this.updateWalletBalance(wallet.id, reward.amount, reward.currency);

      // Criar transação de recompensa
      await this.transactionsService.createTransaction({
        fromWalletId: wallet.id,
        toWalletId: wallet.id, // Auto-transação
        fromUserId: userId,
        toUserId: userId,
        type: this.getTransactionTypeForReward(reward.type),
        amount: reward.amount,
        currency: reward.currency,
        description: `Recompensa: ${reward.description}`,
        notes: `Recompensa do tipo ${reward.type}`,
      });

      // Notificar usuário
      await this.notificationsService.createNotification({
        userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Recompensa Reclamada',
        message: `${reward.amount} ${reward.currency} foram adicionados à sua carteira`,
        data: {
          rewardId: reward.id,
          amount: reward.amount,
          currency: reward.currency,
        },
      });

      return {
        reward,
        message: 'Recompensa reclamada com sucesso',
      };
    } catch (error) {
      // Reverter marcação de reclamada em caso de erro
      await this.prisma.reward.update({
        where: { id: rewardId },
        data: {
          claimed: false,
          claimedAt: null,
        },
      });
      throw error;
    }
  }

  async getUserRewards(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [rewards] = await Promise.all([
      this.prisma.reward.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reward.count({
        where: { userId },
      }),
    ]);

    return {
      userId,
      totalPoints: 0,
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
      badges: [],
      availableRewards: rewards.filter(r => !r.claimed).map(r => ({
        id: r.id,
        type: r.type as any,
        name: r.description,
        description: r.description,
        value: r.amount,
        pointsCost: 0,
        status: 'AVAILABLE' as any,
        expiresAt: r.expiresAt,
        redeemedAt: null,
      })),
      redeemedRewards: rewards.filter(r => r.claimed).map(r => ({
        id: r.id,
        type: r.type as any,
        name: r.description,
        description: r.description,
        value: r.amount,
        pointsCost: 0,
        status: 'REDEEMED' as any,
        expiresAt: r.expiresAt,
        redeemedAt: r.claimedAt,
      })),
    };
  }

  async getAvailableRewards(userId: string, _filter?: any) {
    const rewards = await this.prisma.reward.findMany({
      where: {
        userId,
        claimed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return rewards;
  }

  async getAvailableBadges() {
    return [
      {
        id: 'first_transaction',
        name: 'Primeira Transação',
        description: 'Complete sua primeira transação',
        icon: 'star',
        isUnlocked: false,
      },
      {
        id: 'validator',
        name: 'Validador',
        description: 'Valide 10 usuários',
        icon: 'shield',
        isUnlocked: false,
      },
      {
        id: 'referrer',
        name: 'Referenciador',
        description: 'Convide 5 amigos',
        icon: 'users',
        isUnlocked: false,
      },
    ];
  }

  async getUserPoints(_userId: string) {
    return {
      totalPoints: 0,
      level: 1,
      experience: 0,
      nextLevelPoints: 100,
    };
  }

  async redeemReward(_userId: string, _redeemRewardDto: any) {
    return {
      success: true,
      message: 'Recompensa resgatada com sucesso',
      rewardId: 'mock-reward-id',
    };
  }

  async getRewardHistory(_userId: string, _filter: any, page: number = 1, _limit: number = 20) {
    return {
      rewards: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }

  async getBadgeDetails(badgeId: string) {
    return {
      id: badgeId,
      name: 'Badge Name',
      description: 'Badge description',
      icon: 'star',
      isUnlocked: false,
      progress: 0,
      totalRequired: 10,
    };
  }

  async getRewardStats(_userId: string) {
    return {
      totalRewards: 0,
      totalPoints: 0,
      level: 1,
      experience: 0,
    };
  }

  async getUserProgress(_userId: string) {
    return {
      level: 1,
      experience: 0,
      nextLevelPoints: 100,
      achievements: [],
    };
  }

  async getUserAchievements(_userId: string) {
    return {
      achievements: [],
      totalAchievements: 0,
      unlockedAchievements: 0,
    };
  }

  async getNextLevelInfo(_userId: string) {
    return {
      currentLevel: 1,
      nextLevel: 2,
      experienceNeeded: 100,
      rewards: [],
    };
  }

  async getRewardStatistics(userId: string) {
    const [totalRewards, claimedRewards, totalAmount, rewardsByType] = await Promise.all([
      this.prisma.reward.count({
        where: { userId },
      }),
      this.prisma.reward.count({
        where: {
          userId,
          claimed: true,
        },
      }),
      this.prisma.reward.aggregate({
        where: {
          userId,
          claimed: true,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.reward.groupBy({
        by: ['type'],
        where: { userId },
        _count: {
          type: true,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      totalRewards,
      claimedRewards,
      pendingRewards: totalRewards - claimedRewards,
      totalAmountClaimed: totalAmount._sum.amount || 0,
      rewardsByType: rewardsByType.map(r => ({
        type: r.type,
        count: r._count.type,
        totalAmount: r._sum.amount || 0,
      })),
    };
  }

  async processValidationReward(validatorId: string, validatedUserId: string) {
    // Recompensa por validar um usuário (50 AOA)
    await this.createReward({
      userId: validatorId,
      type: 'VALIDATION',
      amount: 50,
      currency: 'AOA',
      description: 'Recompensa por validar um usuário',
      metadata: {
        validatedUserId,
        validatedAt: new Date(),
      },
    });
  }

  async processReferralReward(referrerId: string, referredUserId: string) {
    // Recompensa por referência (100 AOA)
    await this.createReward({
      userId: referrerId,
      type: 'REFERRAL',
      amount: 100,
      currency: 'AOA',
      description: 'Recompensa por referência de usuário',
      metadata: {
        referredUserId,
        referredAt: new Date(),
      },
    });
  }

  async processCashbackReward(userId: string, transactionId: string, amount: number, currency: Currency) {
    // Cashback de 1% em transações (máximo 100 AOA)
    const cashbackAmount = Math.min(amount * 0.01, 100);
    
    if (cashbackAmount > 0) {
      await this.createReward({
        userId,
        type: 'CASHBACK',
        amount: cashbackAmount,
        currency,
        description: 'Cashback de transação',
        metadata: {
          transactionId,
          originalAmount: amount,
          cashbackPercentage: 0.01,
        },
      });
    }
  }

  async processGamificationReward(userId: string, achievement: string, points: number) {
    // Recompensa por conquista (1 AOA por ponto)
    const rewardAmount = points;
    
    await this.createReward({
      userId,
      type: 'GAMIFICATION',
      amount: rewardAmount,
      currency: 'AOA',
      description: `Conquista: ${achievement}`,
      metadata: {
        achievement,
        points,
        earnedAt: new Date(),
      },
    });
  }

  async checkAndAwardDailyLogin(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Verificar se já recebeu recompensa hoje
    const existingReward = await this.prisma.reward.findFirst({
      where: {
        userId,
        type: 'GAMIFICATION',
        metadata: {
          path: ['achievement'],
          equals: 'daily_login',
        },
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!existingReward) {
      await this.createReward({
        userId,
        type: 'GAMIFICATION',
        amount: 10,
        currency: 'AOA',
        description: 'Login diário',
        metadata: {
          achievement: 'daily_login',
          points: 10,
          earnedAt: new Date(),
        },
      });
    }
  }

  async checkAndAwardTransactionStreak(userId: string) {
    // Verificar streak de transações (3 dias consecutivos = 50 AOA)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        fromUserId: userId,
        createdAt: {
          gte: threeDaysAgo,
        },
        type: {
          in: ['TRANSFER', 'PAYMENT_REQUEST', 'SERVICE_PAYMENT'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Agrupar por dia
    const transactionsByDay = new Set();
    transactions.forEach(t => {
      const day = t.createdAt.toDateString();
      transactionsByDay.add(day);
    });

    if (transactionsByDay.size >= 3) {
      // Verificar se já recebeu recompensa por este streak
      const existingReward = await this.prisma.reward.findFirst({
        where: {
          userId,
          type: 'GAMIFICATION',
          metadata: {
            path: ['achievement'],
            equals: 'transaction_streak_3',
          },
          createdAt: {
            gte: threeDaysAgo,
          },
        },
      });

      if (!existingReward) {
        await this.createReward({
          userId,
          type: 'GAMIFICATION',
          amount: 50,
          currency: 'AOA',
          description: 'Streak de 3 dias de transações',
          metadata: {
            achievement: 'transaction_streak_3',
            points: 50,
            earnedAt: new Date(),
          },
        });
      }
    }
  }

  async getLeaderboard(limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Últimos 30 dias

    const leaderboard = await this.prisma.reward.groupBy({
      by: ['userId'],
      where: {
        claimed: true,
        claimedAt: {
          gte: startDate,
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: limit,
    });

    // Buscar informações dos usuários
    const userIds = leaderboard.map(l => l.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    return leaderboard.map((entry, index) => {
      const user = users.find(u => u.id === entry.userId);
      return {
        rank: index + 1,
        userId: entry.userId,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        userEmail: user ? user.phone : '',
        totalPoints: Math.floor((entry._sum.amount || 0) / 10),
        level: Math.floor((entry._sum.amount || 0) / 100) + 1,
        badgesCount: 0,
        totalRewards: entry._sum.amount || 0,
        user: user || { id: entry.userId, firstName: 'Unknown', lastName: 'User', phone: '' },
      };
    });
  }

  private getTransactionTypeForReward(rewardType: RewardType): string {
    const mapping = {
      VALIDATION: 'VALIDATION_REWARD',
      REFERRAL: 'REFERRAL_BONUS',
      CASHBACK: 'CASHBACK',
      BONUS: 'BONUS',
      GAMIFICATION: 'BONUS',
    };

    return mapping[rewardType] || 'BONUS';
  }

  private async updateWalletBalance(walletId: string, amount: number, currency: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { balances: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    const currentBalance = (wallet.balances as any)[currency] || 0;
    const newBalance = currentBalance + amount;

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
                  balances: {
            ...(wallet.balances as any),
            [currency]: newBalance,
          },
      },
    });
  }
}
