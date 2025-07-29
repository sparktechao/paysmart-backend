import { 
  Controller, 
  Post, 
  Put, 
  Get,
  Query,
  Body,
  Param, 
  UseGuards, 
  Req,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { 
  CreateTransactionDto, 
  TransactionResponseDto,
  TransactionFilterDto
} from './dto/transactions.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova transação' })
  @ApiResponse({ 
    status: 201, 
    description: 'Transação criada com sucesso',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Saldo insuficiente' })
  async createTransaction(
    @Req() req: Request,
    @Body() createTransactionDto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    const userId = req.user['id'];
    
    console.log('🎯 [CONTROLLER] Dados recebidos:', createTransactionDto);
    console.log('🎯 [CONTROLLER] User ID:', userId);
    
    // Preparar dados da transação baseado no tipo
    const transactionData = {
      ...createTransactionDto,
    };

    // Adicionar fromUserId apenas se não for DEPOSIT
    if (createTransactionDto.type !== 'DEPOSIT') {
      transactionData.fromUserId = userId;
    }
    
    // Adicionar toUserId apenas se não for WITHDRAWAL
    if (createTransactionDto.type !== 'WITHDRAWAL') {
      transactionData.toUserId = userId;
    }
    
    console.log('🎯 [CONTROLLER] Dados enviados para service:', transactionData);
    
    return this.transactionsService.createTransaction(transactionData);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de transações do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de transações',
    type: [TransactionResponseDto] 
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrar por tipo de transação' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por status' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filtrar por moeda' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Data de início (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Data de fim (ISO)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite de resultados', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset para paginação', type: Number })
  async getTransactionHistory(
    @Req() req: Request,
    @Query() filters: TransactionFilterDto
  ): Promise<TransactionResponseDto[]> {
    const userId = req.user['id'];
    return this.transactionsService.getTransactionHistory(userId, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obter estatísticas de transações do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estatísticas de transações'
  })
  async getTransactionStats(@Req() req: Request): Promise<any> {
    const userId = req.user['id'];
    return this.transactionsService.getTransactionStats(userId);
  }

  @Put(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar condição de smart contract' })
  @ApiResponse({ 
    status: 200, 
    description: 'Smart contract confirmado com sucesso',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  @ApiResponse({ status: 400, description: 'Transação não é um smart contract' })
  async confirmSmartContractCondition(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<TransactionResponseDto> {
    const userId = req.user['id'];
    return this.transactionsService.confirmSmartContractCondition(id, userId);
  }
} 