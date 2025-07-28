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
import { PaymentRequestsService } from './payment-requests.service';
import { 
  CreatePaymentRequestDto, 
  PaymentRequestResponseDto
} from './dto/payment-requests.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { Currency, RequestCategory } from '@prisma/client';

@ApiTags('payment-requests')
@Controller('payment-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentRequestsController {
  constructor(private readonly paymentRequestsService: PaymentRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar solicitação de pagamento' })
  @ApiResponse({ 
    status: 201, 
    description: 'Solicitação criada com sucesso',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createPaymentRequest(
    @Req() req: Request,
    @Body() createPaymentRequestDto: CreatePaymentRequestDto
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.createPaymentRequest({
      requesterId: userId,
      payerId: createPaymentRequestDto.payerId,
      amount: createPaymentRequestDto.amount,
      currency: Currency.AOA, // Default currency
      description: createPaymentRequestDto.description,
      category: createPaymentRequestDto.category || RequestCategory.PERSONAL, // Default category
      expiresAt: createPaymentRequestDto.expiresAt ? new Date(createPaymentRequestDto.expiresAt) : undefined,
      metadata: createPaymentRequestDto.metadata,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitações de pagamento do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de solicitações',
    type: [PaymentRequestResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserPaymentRequests(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getUserPaymentRequests(userId, page, limit);
  }

  @Get('received')
  @ApiOperation({ summary: 'Listar solicitações de pagamento recebidas' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de solicitações recebidas',
    type: [PaymentRequestResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReceivedPaymentRequests(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getReceivedPaymentRequests(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter solicitação de pagamento por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitação encontrada',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  async getPaymentRequestById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.getPaymentRequestById(id, userId);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar solicitação de pagamento' })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitação aprovada com sucesso',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 400, description: 'Solicitação não pode ser aprovada' })
  async approvePaymentRequest(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.approvePaymentRequest(id, userId);
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar solicitação de pagamento' })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitação rejeitada com sucesso',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 400, description: 'Solicitação não pode ser rejeitada' })
  async rejectPaymentRequest(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.rejectPaymentRequest(id, userId);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar solicitação de pagamento' })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitação cancelada com sucesso',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 400, description: 'Solicitação não pode ser cancelada' })
  async cancelPaymentRequest(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.cancelPaymentRequest(id, userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Obter solicitações pendentes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitações pendentes',
    type: [PaymentRequestResponseDto] 
  })
  async getPendingPaymentRequests(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getPendingPaymentRequests(userId, 1, 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de solicitações de pagamento' })
  @ApiResponse({ status: 200, description: 'Estatísticas das solicitações' })
  async getPaymentRequestStats(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getPaymentRequestStats(userId);
  }
}
