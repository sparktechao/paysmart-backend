import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RateioService } from './rateio.service';
import { 
  CreateRateioDto,
  RateioResponseDto
} from './dto/rateio.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('rateio')
@Controller('rateio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RateioController {
  constructor(private readonly rateioService: RateioService) {}

  @Post()
  @ApiOperation({ summary: 'Criar rateio' })
  @ApiResponse({ 
    status: 201, 
    description: 'Rateio criado com sucesso',
    type: RateioResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createRateio(
    @Req() req: Request,
    @Body() createRateioDto: CreateRateioDto
  ): Promise<RateioResponseDto> {
    const userId = req.user['id'];
    return this.rateioService.createRateio({
      fromUserId: userId,
      fromWalletId: createRateioDto.fromWalletId,
      totalAmount: createRateioDto.totalAmount,
      currency: 'AOA', // Default currency
      description: createRateioDto.description,
      recipients: createRateioDto.participants.map(p => ({
        walletId: p.userId, // Assumindo que userId é o walletId
        userId: p.userId,
        amount: p.amount,
        percentage: (p.amount / createRateioDto.totalAmount) * 100,
      })),
      scheduleDate: createRateioDto.scheduleDate ? new Date(createRateioDto.scheduleDate) : undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar rateios do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de rateios',
    type: [RateioResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserRateios(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.rateioService.getUserRateios(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter rateio por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rateio encontrado',
    type: RateioResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Rateio não encontrado' })
  async getRateioById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<RateioResponseDto> {
    const userId = req.user['id'];
    return this.rateioService.getRateioById(id, userId);
  }

  @Put(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar participação no rateio' })
  @ApiResponse({ 
    status: 200, 
    description: 'Participação confirmada com sucesso',
    type: RateioResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Rateio não encontrado' })
  @ApiResponse({ status: 400, description: 'Participação não pode ser confirmada' })
  async confirmRateio(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<RateioResponseDto> {
    const userId = req.user['id'];
    return this.rateioService.confirmRateio(id, userId);
  }

  @Put(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusar participação no rateio' })
  @ApiResponse({ 
    status: 200, 
    description: 'Participação recusada com sucesso',
    type: RateioResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Rateio não encontrado' })
  @ApiResponse({ status: 400, description: 'Participação não pode ser recusada' })
  async declineRateio(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<RateioResponseDto> {
    const userId = req.user['id'];
    return this.rateioService.declineRateio(id, userId);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar rateio' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rateio cancelado com sucesso',
    type: RateioResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Rateio não encontrado' })
  @ApiResponse({ status: 400, description: 'Rateio não pode ser cancelado' })
  async cancelRateio(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<RateioResponseDto> {
    const userId = req.user['id'];
    return this.rateioService.cancelRateio(id, userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Obter rateios pendentes de confirmação' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rateios pendentes',
    type: [RateioResponseDto] 
  })
  async getPendingRateios(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rateioService.getPendingRateios(userId, 1, 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de rateios' })
  @ApiResponse({ status: 200, description: 'Estatísticas dos rateios' })
  async getRateioStats(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.rateioService.getRateioStats(userId);
  }
}
