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
import { ServicesService } from './services.service';
import { 
  PayServiceDto, 
  ServicePaymentResponseDto,
  ValidateAccountDto,
  AccountValidationResponseDto,
  ServiceHistoryDto,
  AvailableServiceDto
} from './dto/services.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('pay')
  @ApiOperation({ summary: 'Pagar serviço' })
  @ApiResponse({ 
    status: 201, 
    description: 'Pagamento iniciado com sucesso',
    type: ServicePaymentResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Saldo insuficiente' })
  async payService(
    @Req() req: Request,
    @Body() payServiceDto: PayServiceDto
  ): Promise<ServicePaymentResponseDto> {
    const userId = req.user['id'];
    return this.servicesService.payService({
      userId,
      fromWalletId: payServiceDto.walletId,
      serviceType: payServiceDto.serviceType,
      provider: payServiceDto.provider,
      accountNumber: payServiceDto.accountNumber,
      amount: payServiceDto.amount,
      currency: payServiceDto.currency,
      description: payServiceDto.description,
    });
  }

  @Post('validate-account')
  @ApiOperation({ summary: 'Validar conta de serviço' })
  @ApiResponse({ 
    status: 200, 
    description: 'Conta validada',
    type: AccountValidationResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async validateAccount(
    @Body() validateAccountDto: ValidateAccountDto
  ): Promise<AccountValidationResponseDto> {
    return this.servicesService.validateAccount(validateAccountDto);
  }

  @Get('available')
  @ApiOperation({ summary: 'Listar serviços disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de serviços disponíveis',
    type: [AvailableServiceDto] 
  })
  async getAvailableServices(): Promise<AvailableServiceDto[]> {
    return this.servicesService.getAvailableServices();
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de pagamentos de serviços' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico de pagamentos',
    type: [ServicePaymentResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getServiceHistory(
    @Req() req: Request,
    @Query() _filter: ServiceHistoryDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.servicesService.getServiceHistory(userId, page, limit);
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Obter detalhes de um pagamento de serviço' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detalhes do pagamento',
    type: ServicePaymentResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Pagamento não encontrado' })
  async getServicePaymentById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<ServicePaymentResponseDto> {
    const userId = req.user['id'];
    return this.servicesService.getServicePaymentById(id, userId);
  }

  @Get('types')
  @ApiOperation({ summary: 'Obter tipos de serviços disponíveis' })
  @ApiResponse({ status: 200, description: 'Tipos de serviços' })
  async getServiceTypes() {
    return this.servicesService.getServiceTypes();
  }

  @Get('fees')
  @ApiOperation({ summary: 'Obter taxas dos serviços' })
  @ApiResponse({ status: 200, description: 'Taxas dos serviços' })
  async getServiceFees() {
    return this.servicesService.getServiceFees();
  }

  @Post('bulk-pay')
  @ApiOperation({ summary: 'Pagar múltiplos serviços' })
  @ApiResponse({ 
    status: 201, 
    description: 'Pagamentos iniciados com sucesso',
    type: [ServicePaymentResponseDto] 
  })
  async payMultipleServices(
    @Req() req: Request,
    @Body() payments: PayServiceDto[]
  ): Promise<ServicePaymentResponseDto[]> {
    const userId = req.user['id'];
    return this.servicesService.payMultipleServices({
      userId,
      fromWalletId: payments[0]?.walletId || '',
      services: payments.map(payment => ({
        serviceType: payment.serviceType,
        provider: payment.provider,
        accountNumber: payment.accountNumber,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
      })),
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de pagamentos de serviços' })
  @ApiResponse({ status: 200, description: 'Estatísticas dos pagamentos' })
  async getServiceStats(
    @Req() req: Request,
    @Query() _filter: ServiceHistoryDto
  ) {
    const userId = req.user['id'];
    return this.servicesService.getServiceStats(userId);
  }
}
