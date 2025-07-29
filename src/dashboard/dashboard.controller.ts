import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { DashboardSummaryDto, DashboardChartsDto, QuickActionDto, DashboardChartsQueryDto } from './dto/dashboard.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo completo do dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Resumo do dashboard com dados do usuário, carteira padrão, transações recentes e estatísticas',
    type: DashboardSummaryDto
  })
  async getDashboardSummary(@Req() req: Request): Promise<DashboardSummaryDto> {
    const userId = req.user['id'];
    return this.dashboardService.getDashboardSummary(userId);
  }

  @Get('charts')
  @ApiOperation({ summary: 'Obter dados para gráficos do dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Dados para gráficos incluindo evolução do saldo, tipos de transação e resumo mensal',
    type: DashboardChartsDto
  })
  @ApiQuery({ name: 'period', required: false, description: 'Período: week, month, year', enum: ['week', 'month', 'year'] })
  @ApiQuery({ name: 'startDate', required: false, description: 'Data de início (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Data de fim (ISO)' })
  async getDashboardCharts(
    @Req() req: Request,
    @Query() query: DashboardChartsQueryDto
  ): Promise<DashboardChartsDto> {
    const userId = req.user['id'];
    return this.dashboardService.getDashboardCharts(userId, query);
  }

  @Get('quick-actions')
  @ApiOperation({ summary: 'Obter ações rápidas personalizadas para o usuário' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ações rápidas baseadas no tipo de usuário',
    type: [QuickActionDto]
  })
  async getQuickActions(@Req() req: Request): Promise<QuickActionDto[]> {
    const userId = req.user['id'];
    return this.dashboardService.getQuickActions(userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obter estatísticas rápidas do dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas rápidas incluindo saldo total, número de carteiras, validações pendentes e notificações'
  })
  async getQuickStats(@Req() req: Request) {
    const userId = req.user['id'];
    const summary = await this.dashboardService.getDashboardSummary(userId);
    return summary.quickStats;
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Obter atividade recente do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Transações recentes do usuário'
  })
  async getRecentActivity(@Req() req: Request) {
    const userId = req.user['id'];
    const summary = await this.dashboardService.getDashboardSummary(userId);
    return {
      transactions: summary.recentTransactions,
      total: summary.recentTransactions.length
    };
  }

  @Get('balance-overview')
  @ApiOperation({ summary: 'Obter visão geral do saldo' })
  @ApiResponse({
    status: 200,
    description: 'Visão geral do saldo incluindo carteira padrão e saldo total'
  })
  async getBalanceOverview(@Req() req: Request) {
    const userId = req.user['id'];
    const summary = await this.dashboardService.getDashboardSummary(userId);
    return {
      defaultWallet: summary.defaultWallet,
      totalBalance: summary.quickStats.totalBalance,
      totalWallets: summary.quickStats.totalWallets
    };
  }
}