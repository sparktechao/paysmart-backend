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
import { SmartContractsService } from './smart-contracts.service';
import { 
  CreateSmartContractDto, 
  SmartContractResponseDto,
  ConfirmConditionDto,
  SmartContractFilterDto
} from './dto/smart-contracts.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('smart-contracts')
@Controller('smart-contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmartContractsController {
  constructor(private readonly smartContractsService: SmartContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar smart contract' })
  @ApiResponse({ 
    status: 201, 
    description: 'Smart contract criado com sucesso',
    type: SmartContractResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createSmartContract(
    @Req() req: Request,
    @Body() createSmartContractDto: CreateSmartContractDto
  ): Promise<SmartContractResponseDto> {
    const userId = req.user['id'];
    // Mapear condições para o formato esperado pelo serviço
    const conditions = {
      type: (createSmartContractDto.conditions[0]?.type as 'MANUAL_CONFIRM' | 'TIME_BASED' | 'MULTI_PARTY') || 'MANUAL_CONFIRM',
      details: createSmartContractDto.conditions[0]?.details || {},
    };

    return this.smartContractsService.createSmartContract({
      fromUserId: userId,
      fromWalletId: createSmartContractDto.fromWalletId,
      toUserId: userId, // TODO: Determinar o usuário correto baseado no toWalletId
      toWalletId: createSmartContractDto.toWalletId,
      amount: createSmartContractDto.amount,
      currency: createSmartContractDto.currency,
      description: createSmartContractDto.description,
      conditions,
      metadata: createSmartContractDto.metadata,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar smart contracts do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de smart contracts',
    type: [SmartContractResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserSmartContracts(
    @Req() req: Request,
    @Query() _filter: SmartContractFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.smartContractsService.getUserSmartContracts(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter smart contract por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Smart contract encontrado',
    type: SmartContractResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Smart contract não encontrado' })
  async getSmartContractById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<SmartContractResponseDto> {
    const userId = req.user['id'];
    return this.smartContractsService.getSmartContractById(id, userId);
  }

  @Put(':id/confirm-condition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar condição de smart contract' })
  @ApiResponse({ 
    status: 200, 
    description: 'Condição confirmada com sucesso',
    type: SmartContractResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Smart contract não encontrado' })
  @ApiResponse({ status: 400, description: 'Condição não pode ser confirmada' })
  async confirmCondition(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() confirmConditionDto: ConfirmConditionDto
  ): Promise<SmartContractResponseDto> {
    const userId = req.user['id'];
    return this.smartContractsService.confirmCondition(id, userId, confirmConditionDto);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar smart contract' })
  @ApiResponse({ 
    status: 200, 
    description: 'Smart contract cancelado com sucesso',
    type: SmartContractResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Smart contract não encontrado' })
  @ApiResponse({ status: 400, description: 'Smart contract não pode ser cancelado' })
  async cancelSmartContract(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<SmartContractResponseDto> {
    const userId = req.user['id'];
    return this.smartContractsService.cancelSmartContract(id, userId);
  }

  @Get('pending-confirmations')
  @ApiOperation({ summary: 'Obter smart contracts pendentes de confirmação' })
  @ApiResponse({ 
    status: 200, 
    description: 'Smart contracts pendentes',
    type: [SmartContractResponseDto] 
  })
  async getPendingConfirmations(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.smartContractsService.getPendingConfirmations(userId, page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de smart contracts' })
  @ApiResponse({ status: 200, description: 'Estatísticas dos smart contracts' })
  async getSmartContractStats(
    @Req() req: Request,
    @Query() _filter: SmartContractFilterDto
  ) {
    const userId = req.user['id'];
    return this.smartContractsService.getSmartContractStats(userId);
  }
}
