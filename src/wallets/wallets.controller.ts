import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter carteiras do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de carteiras do usuário' })
  async getUserWallets(@Req() req: Request) {
    const userId = req.user['id'];
    return this.walletsService.getUserWallets(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter carteira por ID' })
  @ApiResponse({ status: 200, description: 'Carteira encontrada' })
  async getWalletById(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletById(id, userId);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Obter saldo da carteira' })
  @ApiResponse({ status: 200, description: 'Saldo da carteira' })
  async getWalletBalance(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletBalance(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova carteira' })
  @ApiResponse({ status: 201, description: 'Carteira criada com sucesso' })
  async createWallet(@Req() req: Request, @Body() data: any) {
    const userId = req.user['id'];
    return this.walletsService.createWallet(userId, data);
  }
} 