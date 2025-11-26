import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { CreateWalletDto, UpdateWalletDto, WalletResponseDto } from './dto/wallets.dto';
import { Request } from 'express';

@ApiTags('wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter carteiras do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de carteiras do usuário', type: [WalletResponseDto] })
  async getUserWallets(@Req() req: Request) {
    const userId = req.user['id'];
    return this.walletsService.getUserWallets(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter carteira por ID' })
  @ApiResponse({ status: 200, description: 'Carteira encontrada', type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada' })
  async getWalletById(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletById(id, userId);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Obter saldo da carteira' })
  @ApiResponse({ status: 200, description: 'Saldo da carteira' })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada' })
  async getWalletBalance(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletBalance(id, userId);
  }

  @Post()
  @ApiOperation({ 
    summary: 'Criar nova carteira',
    description: 'Cria uma nova carteira. Pode ser do tipo PERSONAL, BUSINESS ou MERCHANT. BUSINESS e MERCHANT requerem informações adicionais.'
  })
  @ApiResponse({ status: 201, description: 'Carteira criada com sucesso', type: WalletResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async createWallet(@Req() req: Request, @Body() createWalletDto: CreateWalletDto) {
    const userId = req.user['id'];
    return this.walletsService.createWallet(userId, createWalletDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar carteira' })
  @ApiResponse({ status: 200, description: 'Carteira atualizada com sucesso', type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada' })
  async updateWallet(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateWalletDto: UpdateWalletDto
  ) {
    const userId = req.user['id'];
    return this.walletsService.updateWallet(id, userId, updateWalletDto);
  }
} 