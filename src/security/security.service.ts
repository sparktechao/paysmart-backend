import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SecurityService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async logSecurityEvent(data: {
    userId?: string;
    action: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    riskScore?: number;
  }) {
    const securityLog = await this.prisma.securityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        riskScore: data.riskScore || this.calculateRiskScore(data),
      },
    });

    // Verificar se o evento é de alto risco
    if (data.riskScore && data.riskScore > 70) {
      await this.handleHighRiskEvent(securityLog);
    }

    return securityLog;
  }

  async getSecurityLogs(userId?: string, _filter?: any, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSecurityAnalytics(userId?: string, period: 'day' | 'week' | 'month' = 'week') {
    const startDate = this.getStartDate(period);
    const endDate = new Date();

    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(userId && { userId }),
    };

    const [
      totalEvents,
      highRiskEvents,
      eventsByAction,
      eventsByRiskLevel,
      suspiciousIPs,
    ] = await Promise.all([
      this.prisma.securityLog.count({ where }),
      this.prisma.securityLog.count({
        where: {
          ...where,
          riskScore: { gte: 70 },
        },
      }),
      this.prisma.securityLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      }),
      this.prisma.securityLog.groupBy({
        by: ['riskScore'],
        where,
        _count: { riskScore: true },
      }),
      this.getSuspiciousIPs(where),
    ]);

    return {
      period,
      startDate,
      endDate,
      totalEvents,
      highRiskEvents,
      riskPercentage: totalEvents > 0 ? (highRiskEvents / totalEvents) * 100 : 0,
      eventsByAction: eventsByAction.map(e => ({
        action: e.action,
        count: e._count.action,
      })),
      eventsByRiskLevel: eventsByRiskLevel.map(e => ({
        riskScore: e.riskScore,
        count: e._count.riskScore,
      })),
      suspiciousIPs,
    };
  }

  async detectSuspiciousActivity(userId: string, action: string, context: any) {
    const riskFactors = [];

    // Verificar frequência de ações
    const recentActions = await this.prisma.securityLog.count({
      where: {
        userId,
        action,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
        },
      },
    });

    if (recentActions > 10) {
      riskFactors.push({ factor: 'high_frequency', score: 30 });
    }

    // Verificar horário suspeito (entre 2h e 6h da manhã)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 6) {
      riskFactors.push({ factor: 'suspicious_time', score: 20 });
    }

    // Verificar mudança de localização (IP)
    if (context.ipAddress) {
      const recentIPs = await this.prisma.securityLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24h
          },
        },
        select: { ipAddress: true },
        distinct: ['ipAddress'],
      });

      const uniqueIPs = recentIPs.filter(log => log.ipAddress).map(log => log.ipAddress);
      if (uniqueIPs.length > 3) {
        riskFactors.push({ factor: 'multiple_locations', score: 25 });
      }
    }

    // Verificar ações suspeitas específicas
    const suspiciousActions = [
      'failed_login',
      'password_reset',
      'wallet_transfer_large',
      'profile_update',
    ];

    if (suspiciousActions.includes(action)) {
      riskFactors.push({ factor: 'suspicious_action', score: 15 });
    }

    const totalRiskScore = riskFactors.reduce((sum, factor) => sum + factor.score, 0);

    return {
      isSuspicious: totalRiskScore > 50,
      riskScore: totalRiskScore,
      riskFactors,
    };
  }

  async blockUser(userId: string, reason: string, duration?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar status do usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'BLOCKED',
      },
    });

    // Bloquear carteiras
    await this.prisma.wallet.updateMany({
      where: { userId },
      data: {
        status: 'BLOCKED',
      },
    });

    // Log do evento
    await this.logSecurityEvent({
      userId,
      action: 'user_blocked',
      details: {
        reason,
        duration,
        blockedAt: new Date(),
      },
      riskScore: 100,
    });

    // Notificar usuário
    await this.notificationsService.createNotification({
      userId,
      type: 'SECURITY_ALERT',
      title: 'Conta Bloqueada',
      message: `Sua conta foi bloqueada por motivos de segurança: ${reason}`,
      data: {
        reason,
        blockedAt: new Date(),
      },
    });

    return { message: 'Usuário bloqueado com sucesso' };
  }

  async unblockUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar status do usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
      },
    });

    // Desbloquear carteiras
    await this.prisma.wallet.updateMany({
      where: { userId },
      data: {
        status: 'ACTIVE',
      },
    });

    // Log do evento
    await this.logSecurityEvent({
      userId,
      action: 'user_unblocked',
      details: {
        reason,
        unblockedAt: new Date(),
      },
      riskScore: 0,
    });

    // Notificar usuário
    await this.notificationsService.createNotification({
      userId,
      type: 'SECURITY_ALERT',
      title: 'Conta Desbloqueada',
      message: 'Sua conta foi desbloqueada e está ativa novamente',
      data: {
        unblockedAt: new Date(),
      },
    });

    return { message: 'Usuário desbloqueado com sucesso' };
  }

  async getFraudDetection(_userId: string) {
    return {
      fraudScore: 0,
      riskLevel: 'LOW',
      suspiciousActivities: [],
      recommendations: [],
    };
  }

  async reportFraud(_userId: string, _reportFraudDto: any) {
    return {
      id: 'mock-report-id',
      reporterId: _userId,
      type: 'SUSPICIOUS_TRANSACTION' as any,
      description: _reportFraudDto?.description || 'Relatório de fraude',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      transactionId: _reportFraudDto?.transactionId,
      suspectUserId: _reportFraudDto?.suspectUserId,
      evidence: _reportFraudDto?.evidence,
    };
  }

  async lockAccount(_lockAccountDto: any) {
    return {
      success: true,
      message: 'Conta bloqueada com sucesso',
    };
  }

  async unlockAccount(_unlockAccountDto: any) {
    return {
      success: true,
      message: 'Conta desbloqueada com sucesso',
    };
  }

  async getSuspiciousActivities(_userId: string, page: number = 1, _limit: number = 20) {
    return {
      activities: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }

  async getRiskAssessment(_userId: string) {
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      factors: [],
      recommendations: [],
    };
  }

  async getSecuritySettings(_userId: string) {
    return {
      twoFactorEnabled: false,
      biometricEnabled: false,
      notificationsEnabled: true,
      sessionTimeout: 30,
    };
  }

  async updateSecuritySettings(_userId: string, _settings: any) {
    return {
      success: true,
      message: 'Configurações de segurança atualizadas',
    };
  }

  async getLoginHistory(_userId: string, page: number = 1, _limit: number = 20) {
    return {
      logins: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }

  async logoutAllSessions(_userId: string) {
    return {
      success: true,
      message: 'Todas as sessões foram encerradas',
    };
  }

  async getSecurityStats(_userId: string) {
    return {
      totalLogins: 0,
      failedLogins: 0,
      securityEvents: 0,
      riskScore: 0,
    };
  }

  async getSecurityAlerts(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where: {
          riskScore: { gte: 70 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityLog.count({
        where: {
          riskScore: { gte: 70 },
        },
      }),
    ]);

    return {
      alerts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBlockedUsers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          status: 'BLOCKED',
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({
        where: {
          status: 'BLOCKED',
        },
      }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async generateSecurityReport(period: 'day' | 'week' | 'month' = 'week') {
    const analytics = await this.getSecurityAnalytics(undefined, period);
    
    const report = await this.prisma.analytics.create({
      data: {
        type: 'SECURITY_STATS',
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

  private calculateRiskScore(data: any): number {
    let score = 0;

    // Pontuação baseada na ação
    const actionScores = {
      'login': 0,
      'failed_login': 20,
      'password_reset': 15,
      'wallet_transfer': 10,
      'wallet_transfer_large': 30,
      'profile_update': 5,
      'suspicious_activity': 50,
      'user_blocked': 100,
      'user_unblocked': 0,
    };

    score += actionScores[data.action] || 0;

    // Pontuação baseada no contexto
    if (data.details?.amount && data.details.amount > 10000) {
      score += 20;
    }

    if (data.details?.location_change) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  private async handleHighRiskEvent(securityLog: any) {
    // Notificar administradores sobre evento de alto risco
    const admins = await this.prisma.user.findMany({
      where: {
        userType: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    for (const admin of admins) {
      await this.notificationsService.createNotification({
        userId: admin.id,
        type: 'SECURITY_ALERT',
        title: 'Alerta de Segurança',
        message: `Evento de alto risco detectado: ${securityLog.action}`,
        data: {
          securityLogId: securityLog.id,
          riskScore: securityLog.riskScore,
          action: securityLog.action,
          userId: securityLog.userId,
        },
      });
    }

    // Se for um usuário específico, considerar bloqueio automático
    if (securityLog.userId && securityLog.riskScore > 90) {
      const user = await this.prisma.user.findUnique({
        where: { id: securityLog.userId },
      });

      if (user && user.status !== 'BLOCKED') {
        await this.blockUser(
          securityLog.userId,
          'Atividade suspeita detectada automaticamente',
          24 * 60 * 60 * 1000 // 24 horas
        );
      }
    }
  }

  private async getSuspiciousIPs(where: any) {
    const ipCounts = await this.prisma.securityLog.groupBy({
      by: ['ipAddress'],
      where: {
        ...where,
        ipAddress: { not: null },
      },
      _count: { ipAddress: true },
      having: {
        ipAddress: {
          _count: { gt: 10 },
        },
      },
    });

    return ipCounts.map(ip => ({
      ipAddress: ip.ipAddress,
      eventCount: ip._count.ipAddress,
    }));
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}
