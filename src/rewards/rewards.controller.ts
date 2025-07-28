import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { 
  UserRewardsResponseDto, 
  LeaderboardEntryDto,
  RedeemRewardDto,
  RewardHistoryDto,
  RewardFilterDto
} from './dto/rewards.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('rewards')
@Controller('rewards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter recompensas do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recompensas do usuário',
    type: UserRewardsResponseDto 
  })
  async getUserRewards(
    @Req() req: Request
  ): Promise<UserRewardsResponseDto> {
    const userId = req.user['id'];
    return this.rewardsService.getUserRewards(userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Obter ranking de usuários' })
  @ApiResponse({ 
    status: 200, 
    description: 'Ranking de usuários',
    type: [LeaderboardEntryDto] 
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLeaderboard(
    @Query('limit') limit: number = 10
  ): Promise<LeaderboardEntryDto[]> {
    return this.rewardsService.getLeaderboard(limit);
  }

  @Get('badges')
  @ApiOperation({ summary: 'Listar badges disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de badges disponíveis'
  })
  async getAvailableBadges() {
    return this.rewardsService.getAvailableBadges();
  }

  @Get('points')
  @ApiOperation({ summary: 'Obter pontos do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pontos do usuário'
  })
  async getUserPoints(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getUserPoints(userId);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Resgatar recompensa' })
  @ApiResponse({ 
    status: 201, 
    description: 'Recompensa resgatada com sucesso'
  })
  @ApiResponse({ status: 400, description: 'Pontos insuficientes' })
  @ApiResponse({ status: 404, description: 'Recompensa não encontrada' })
  async redeemReward(
    @Req() req: Request,
    @Body() redeemRewardDto: RedeemRewardDto
  ) {
    const userId = req.user['id'];
    return this.rewardsService.redeemReward(userId, redeemRewardDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de recompensas' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico de recompensas',
    type: [RewardHistoryDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRewardHistory(
    @Req() req: Request,
    @Query() filter: RewardFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getRewardHistory(userId, filter, page, limit);
  }

  @Get('available')
  @ApiOperation({ summary: 'Listar recompensas disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de recompensas disponíveis'
  })
  async getAvailableRewards(
    @Req() req: Request,
    @Query() filter: RewardFilterDto
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getAvailableRewards(userId, filter);
  }

  @Get('badges/:badgeId')
  @ApiOperation({ summary: 'Obter detalhes de um badge' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detalhes do badge'
  })
  @ApiResponse({ status: 404, description: 'Badge não encontrado' })
  async getBadgeDetails(
    @Param('badgeId') badgeId: string
  ) {
    return this.rewardsService.getBadgeDetails(badgeId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de recompensas' })
  @ApiResponse({ status: 200, description: 'Estatísticas de recompensas' })
  async getRewardStats(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getRewardStats(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Progresso do usuário' })
  @ApiResponse({ status: 200, description: 'Progresso do usuário' })
  async getUserProgress(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getUserProgress(userId);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Conquistas do usuário' })
  @ApiResponse({ status: 200, description: 'Conquistas do usuário' })
  async getUserAchievements(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getUserAchievements(userId);
  }

  @Get('next-level')
  @ApiOperation({ summary: 'Informações sobre o próximo nível' })
  @ApiResponse({ status: 200, description: 'Informações sobre o próximo nível' })
  async getNextLevelInfo(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rewardsService.getNextLevelInfo(userId);
  }
}
