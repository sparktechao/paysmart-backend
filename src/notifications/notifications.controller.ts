import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { 
  CreateNotificationDto, 
  NotificationResponseDto
} from './dto/notifications.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter notificações do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de notificações', type: [NotificationResponseDto] })
  async getUserNotifications(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const userId = req.user['id'];
    return this.notificationsService.getUserNotifications(userId, page, limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obter contagem de notificações não lidas' })
  @ApiResponse({ status: 200, description: 'Contagem de notificações não lidas' })
  async getUnreadCount(@Req() req: Request) {
    const userId = req.user['id'];
    return this.notificationsService.getUnreadCount(userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  @ApiResponse({ status: 200, description: 'Notificação marcada como lida', type: NotificationResponseDto })
  async markAsRead(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const userId = req.user['id'];
    return this.notificationsService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
  @ApiResponse({ status: 200, description: 'Todas as notificações marcadas como lidas' })
  async markAllAsRead(@Req() req: Request) {
    const userId = req.user['id'];
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir notificação' })
  @ApiResponse({ status: 200, description: 'Notificação excluída com sucesso' })
  async deleteNotification(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const userId = req.user['id'];
    return this.notificationsService.deleteNotification(id, userId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Enviar notificação em massa (apenas admin)' })
  @ApiResponse({ status: 201, description: 'Notificações enviadas com sucesso' })
  async sendBulkNotification(
    @Body() data: { userIds: string[]; notification: Omit<CreateNotificationDto, 'userId'> },
  ) {
    return this.notificationsService.sendBulkNotification(data.userIds, data.notification);
  }
} 