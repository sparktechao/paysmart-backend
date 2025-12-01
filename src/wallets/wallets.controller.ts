import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Listar todas as carteiras do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de carteiras do usuário ordenadas por carteira padrão primeiro',
    type: [WalletResponseDto]
  })
  async getUserWallets(@Req() req: Request) {
    const userId = req.user['id'];
    return this.walletsService.getUserWallets(userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Obter carteira padrão do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteira padrão do usuário' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Carteira padrão não encontrada' 
  })
  async getDefaultWallet(@Req() req: Request) {
    const userId = req.user['id'];
    return this.walletsService.getDefaultWallet(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter carteira específica por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteira encontrada',
    type: WalletResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Carteira não encontrada ou não pertence ao usuário' 
  })
  async getWalletById(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletById(id, userId);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Obter saldo detalhado da carteira' })
  @ApiResponse({ 
    status: 200, 
    description: 'Saldo da carteira com totais por moeda' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Carteira não encontrada ou não pertence ao usuário' 
  })
  async getWalletBalance(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.getWalletBalance(id, userId);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Obter histórico de transações da carteira' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico de transações da carteira' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Carteira não encontrada ou não pertence ao usuário' 
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrar por tipo de transação' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por status' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filtrar por moeda' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Data de início (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Data de fim (ISO)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite de resultados', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset para paginação', type: Number })
  async getWalletTransactions(
    @Req() req: Request, 
    @Param('id') id: string,
    @Query() filters: any
  ) {
    const userId = req.user['id'];
    return this.walletsService.getWalletTransactions(id, userId, filters);
  }

  @Post()
  @ApiOperation({ 
    summary: 'Criar nova carteira',
    description: 'Cria uma nova carteira. Pode ser do tipo PERSONAL, BUSINESS ou MERCHANT. BUSINESS e MERCHANT requerem informações adicionais.'
  })
  @ApiResponse({ status: 201, description: 'Carteira criada com sucesso', type: WalletResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou máximo de carteiras atingido (5 por usuário)' })
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

  @Put(':id/set-default')
  @ApiOperation({ summary: 'Definir carteira como padrão' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteira definida como padrão com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Carteira não encontrada ou não pertence ao usuário' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Carteira já é a padrão ou está inativa' 
  })
  async setDefaultWallet(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.walletsService.setDefaultWallet(id, userId);
  }
} 