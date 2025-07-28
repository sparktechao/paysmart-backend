import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  UseGuards, 
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { 
  ReportFraudDto, 
  FraudReportResponseDto,
  SecurityLogDto,
  SuspiciousActivityDto,
  SecurityFilterDto,
  LockAccountDto,
  UnlockAccountDto
} from './dto/security.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('fraud-detection')
  @ApiOperation({ summary: 'Obter detecção de fraudes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detecção de fraudes'
  })
  async getFraudDetection(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.securityService.getFraudDetection(userId);
  }

  @Post('report-fraud')
  @ApiOperation({ summary: 'Reportar fraude' })
  @ApiResponse({ 
    status: 201, 
    description: 'Fraude reportada com sucesso',
    type: FraudReportResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async reportFraud(
    @Req() req: Request,
    @Body() reportFraudDto: ReportFraudDto
  ): Promise<FraudReportResponseDto> {
    const userId = req.user['id'];
    return this.securityService.reportFraud(userId, reportFraudDto);
  }

  @Get('security-logs')
  @ApiOperation({ summary: 'Obter logs de segurança' })
  @ApiResponse({ 
    status: 200, 
    description: 'Logs de segurança',
    type: [SecurityLogDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSecurityLogs(
    @Req() req: Request,
    @Query() filter: SecurityFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.securityService.getSecurityLogs(userId, filter, page, limit);
  }

  @Post('lock-account')
  @ApiOperation({ summary: 'Bloquear conta' })
  @ApiResponse({ 
    status: 201, 
    description: 'Conta bloqueada com sucesso'
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async lockAccount(
    @Body() lockAccountDto: LockAccountDto
  ) {
    return this.securityService.lockAccount(lockAccountDto);
  }

  @Post('unlock-account')
  @ApiOperation({ summary: 'Desbloquear conta' })
  @ApiResponse({ 
    status: 201, 
    description: 'Conta desbloqueada com sucesso'
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async unlockAccount(
    @Body() unlockAccountDto: UnlockAccountDto
  ) {
    return this.securityService.unlockAccount(unlockAccountDto);
  }

  @Get('suspicious-activities')
  @ApiOperation({ summary: 'Obter atividades suspeitas' })
  @ApiResponse({ 
    status: 200, 
    description: 'Atividades suspeitas',
    type: [SuspiciousActivityDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSuspiciousActivities(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.securityService.getSuspiciousActivities(userId, page, limit);
  }

  @Get('risk-assessment')
  @ApiOperation({ summary: 'Avaliação de risco do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Avaliação de risco'
  })
  async getRiskAssessment(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.securityService.getRiskAssessment(userId);
  }

  @Get('security-settings')
  @ApiOperation({ summary: 'Obter configurações de segurança' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configurações de segurança'
  })
  async getSecuritySettings(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.securityService.getSecuritySettings(userId);
  }

  @Post('security-settings')
  @ApiOperation({ summary: 'Atualizar configurações de segurança' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configurações atualizadas com sucesso'
  })
  async updateSecuritySettings(
    @Req() req: Request,
    @Body() settings: Record<string, any>
  ) {
    const userId = req.user['id'];
    return this.securityService.updateSecuritySettings(userId, settings);
  }

  @Get('login-history')
  @ApiOperation({ summary: 'Histórico de login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico de login'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLoginHistory(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.securityService.getLoginHistory(userId, page, limit);
  }

  @Post('logout-all-sessions')
  @ApiOperation({ summary: 'Fazer logout de todas as sessões' })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout realizado com sucesso'
  })
  async logoutAllSessions(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.securityService.logoutAllSessions(userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de segurança' })
  @ApiResponse({ status: 200, description: 'Estatísticas de segurança' })
  async getSecurityStats(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.securityService.getSecurityStats(userId);
  }
}
