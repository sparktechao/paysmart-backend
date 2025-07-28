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
import { SupportService } from './support.service';
import { 
  CreateTicketDto, 
  TicketResponseDto,
  UpdateTicketDto,
  TicketReplyDto,
  TicketReplyResponseDto,
  TicketFilterDto,
  SupportCategoryDto
} from './dto/support.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Criar ticket de suporte' })
  @ApiResponse({ 
    status: 201, 
    description: 'Ticket criado com sucesso',
    type: TicketResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createTicket(
    @Req() req: Request,
    @Body() createTicketDto: CreateTicketDto
  ): Promise<TicketResponseDto> {
    const userId = req.user['id'];
    return this.supportService.createTicket(userId, createTicketDto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Listar tickets do usuário' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de tickets',
    type: [TicketResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserTickets(
    @Req() req: Request,
    @Query() filter: TicketFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.supportService.getUserTickets(userId, filter, page, limit);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Obter ticket por ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Ticket encontrado',
    type: TicketResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Ticket não encontrado' })
  async getTicketById(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<TicketResponseDto> {
    const userId = req.user['id'];
    return this.supportService.getTicketById(id, userId);
  }

  @Put('tickets/:id')
  @ApiOperation({ summary: 'Atualizar ticket' })
  @ApiResponse({ 
    status: 200, 
    description: 'Ticket atualizado com sucesso',
    type: TicketResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Ticket não encontrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão para atualizar' })
  async updateTicket(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto
  ): Promise<TicketResponseDto> {
    const userId = req.user['id'];
    return this.supportService.updateTicket(id, userId, updateTicketDto);
  }

  @Post('tickets/:id/reply')
  @ApiOperation({ summary: 'Responder ticket' })
  @ApiResponse({ 
    status: 201, 
    description: 'Resposta enviada com sucesso',
    type: TicketReplyResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Ticket não encontrado' })
  async replyToTicket(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() ticketReplyDto: TicketReplyDto
  ): Promise<TicketReplyResponseDto> {
    const userId = req.user['id'];
    return this.supportService.replyToTicket(id, userId, ticketReplyDto);
  }

  @Put('tickets/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fechar ticket' })
  @ApiResponse({ 
    status: 200, 
    description: 'Ticket fechado com sucesso',
    type: TicketResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Ticket não encontrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão para fechar' })
  async closeTicket(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<TicketResponseDto> {
    const userId = req.user['id'];
    return this.supportService.closeTicket(id, userId);
  }

  @Get('tickets/:id/replies')
  @ApiOperation({ summary: 'Obter respostas do ticket' })
  @ApiResponse({ 
    status: 200, 
    description: 'Respostas do ticket',
    type: [TicketReplyResponseDto] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTicketReplies(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') _limit: number = 10
  ) {
    const userId = req.user['id'];
    return this.supportService.getTicketReplies(id, userId, page);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Obter categorias de suporte' })
  @ApiResponse({ 
    status: 200, 
    description: 'Categorias de suporte',
    type: [SupportCategoryDto] 
  })
  async getCategories(): Promise<SupportCategoryDto[]> {
    return this.supportService.getCategories();
  }

  @Get('faq')
  @ApiOperation({ summary: 'Obter FAQ' })
  @ApiResponse({ 
    status: 200, 
    description: 'FAQ'
  })
  async getFAQ() {
    return this.supportService.getFAQ();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de tickets' })
  @ApiResponse({ status: 200, description: 'Estatísticas de tickets' })
  async getTicketStats(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.supportService.getTicketStats(userId);
  }

  @Get('tickets/open')
  @ApiOperation({ summary: 'Obter tickets abertos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tickets abertos',
    type: [TicketResponseDto] 
  })
  async getOpenTickets(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.supportService.getOpenTickets(userId);
  }

  @Get('tickets/urgent')
  @ApiOperation({ summary: 'Obter tickets urgentes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tickets urgentes',
    type: [TicketResponseDto] 
  })
  async getUrgentTickets(
    @Req() req: Request
  ) {
    const userId = req.user['id'];
    return this.supportService.getUrgentTickets(userId);
  }
}
