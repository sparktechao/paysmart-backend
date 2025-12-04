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
  PaymentRequestResponseDto,
  ApprovePaymentRequestDto
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
      payerId: createPaymentRequestDto.payerId || null, // Permite null para payment links públicos
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
  @ApiOperation({ 
    summary: 'Aprovar solicitação de pagamento',
    description: 'Aprova e processa o pagamento da solicitação. Cria uma transação completa, movimenta saldos entre carteiras e atualiza o status do payment request.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Solicitação aprovada e pagamento processado com sucesso',
    type: PaymentRequestResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 400, description: 'Solicitação não pode ser aprovada (expirada, saldo insuficiente, etc.)' })
  @ApiResponse({ status: 403, description: 'PIN inválido ou saldo insuficiente' })
  async approvePaymentRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() approveDto: ApprovePaymentRequestDto
  ): Promise<PaymentRequestResponseDto> {
    const userId = req.user['id'];
    return this.paymentRequestsService.approvePaymentRequest(id, userId, approveDto.pin);
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

  // Endpoints específicos para MERCHANT

  @Get('merchant/stats')
  @ApiOperation({ summary: 'Estatísticas do merchant (apenas para carteiras MERCHANT)' })
  @ApiResponse({ status: 200, description: 'Estatísticas do merchant' })
  @ApiResponse({ status: 400, description: 'Usuário não possui carteira MERCHANT' })
  async getMerchantStats(@Req() req: Request) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getMerchantStats(userId);
  }

  @Get('merchant/payment-links')
  @ApiOperation({ summary: 'Listar links de pagamento do merchant' })
  @ApiResponse({ status: 200, description: 'Lista de links de pagamento' })
  @ApiResponse({ status: 400, description: 'Usuário não possui carteira MERCHANT' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMerchantPaymentLinks(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.getMerchantPaymentLinks(userId, page, limit);
  }

  @Post('merchant/payment-link')
  @ApiOperation({ summary: 'Gerar link de pagamento (apenas para carteiras MERCHANT)' })
  @ApiResponse({ status: 201, description: 'Link de pagamento gerado com sucesso' })
  @ApiResponse({ status: 400, description: 'Usuário não possui carteira MERCHANT ou links não estão habilitados' })
  async generatePaymentLink(
    @Req() req: Request,
    @Body() body: { amount: number; currency: Currency; description: string; expiresInDays?: number }
  ) {
    const userId = req.user['id'];
    return this.paymentRequestsService.generatePaymentLink(
      userId,
      body.amount,
      body.currency,
      body.description,
      body.expiresInDays
    );
  }

  @Get(':id/qr-code')
  @ApiOperation({ 
    summary: 'Gerar QR Code como imagem (apenas para carteiras MERCHANT)',
    description: 'Retorna a imagem do QR code em base64. Para melhor performance, gere o QR code no frontend usando o ID do payment request para construir a URL: ${APP_URL}/payment/{id}'
  })
  @ApiResponse({ status: 200, description: 'QR Code gerado (data URL)' })
  @ApiResponse({ status: 400, description: 'Usuário não possui carteira MERCHANT ou QR Code não está habilitado' })
  async generatePaymentQRCode(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const userId = req.user['id'];
    const qrCode = await this.paymentRequestsService.generatePaymentQRCode(id, userId);
    return { qrCode };
  }
}
