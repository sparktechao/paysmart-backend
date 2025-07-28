import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  UseGuards, 
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { 
  DashboardResponseDto, 
  TransactionAnalyticsDto,
  UserAnalyticsDto,
  RevenueAnalyticsDto,
  GrowthAnalyticsDto,
  AnalyticsFilterDto,
  ExportAnalyticsDto
} from './dto/analytics.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard principal' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard principal',
    type: DashboardResponseDto 
  })
  async getDashboard(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ): Promise<DashboardResponseDto> {
    const userId = req.user['id'];
    return this.analyticsService.getDashboard(userId, filter);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Analytics de transações' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics de transações',
    type: TransactionAnalyticsDto 
  })
  async getTransactionAnalytics(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ): Promise<TransactionAnalyticsDto> {
    const userId = req.user['id'];
    return this.analyticsService.getTransactionAnalytics(userId, filter);
  }

  @Get('users')
  @ApiOperation({ summary: 'Analytics de usuários' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics de usuários',
    type: UserAnalyticsDto 
  })
  async getUserAnalytics(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ): Promise<UserAnalyticsDto> {
    const userId = req.user['id'];
    return this.analyticsService.getUserAnalytics(userId, filter);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Analytics de receita' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics de receita',
    type: RevenueAnalyticsDto 
  })
  async getRevenueAnalytics(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ): Promise<RevenueAnalyticsDto> {
    const userId = req.user['id'];
    return this.analyticsService.getRevenueAnalytics(userId, filter);
  }

  @Get('growth')
  @ApiOperation({ summary: 'Analytics de crescimento' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics de crescimento',
    type: GrowthAnalyticsDto 
  })
  async getGrowthAnalytics(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ): Promise<GrowthAnalyticsDto> {
    const userId = req.user['id'];
    return this.analyticsService.getGrowthAnalytics(userId, filter);
  }

  @Get('engagement')
  @ApiOperation({ summary: 'Analytics de engajamento' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics de engajamento'
  })
  async getEngagementAnalytics(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getEngagementAnalytics(userId, filter);
  }

  @Get('real-time')
  @ApiOperation({ summary: 'Analytics em tempo real' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics em tempo real'
  })
  async getRealTimeAnalytics(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getRealTimeAnalytics(userId);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Tendências' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tendências'
  })
  async getTrends(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getTrends(userId, filter);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Comparação de períodos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Comparação de períodos'
  })
  async getComparison(
    @Req() req: Request,
    @Query('period1') period1: string,
    @Query('period2') period2: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getComparison(userId, period1, period2, filter);
  }

  @Post('export')
  @ApiOperation({ summary: 'Exportar relatórios' })
  @ApiResponse({ 
    status: 200, 
    description: 'Arquivo de exportação'
  })
  async exportAnalytics(
    @Req() req: Request,
    @Body() exportAnalyticsDto: ExportAnalyticsDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.exportAnalytics(userId, exportAnalyticsDto);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs principais' })
  @ApiResponse({ 
    status: 200, 
    description: 'KPIs principais'
  })
  async getKPIs(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getKPIs(userId, filter);
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Previsões' })
  @ApiResponse({ 
    status: 200, 
    description: 'Previsões'
  })
  async getPredictions(
    @Req() req: Request,
    @Query() filter: AnalyticsFilterDto
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getPredictions(userId, filter);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Alertas de analytics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Alertas de analytics'
  })
  async getAnalyticsAlerts(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.analyticsService.getAnalyticsAlerts(userId);
  }
}
