import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID do usuário destinatário' })
  @IsString()
  userId: string;

  @ApiProperty({ 
    enum: NotificationType,
    description: 'Tipo da notificação'
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Título da notificação' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Mensagem da notificação' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Dados adicionais da notificação' })
  @IsOptional()
  @IsObject()
  data?: any;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: any;

  @ApiProperty()
  status: string;

  @ApiProperty()
  readAt?: Date;

  @ApiProperty()
  sentAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class MarkAsReadDto {
  @ApiProperty({ description: 'ID da notificação' })
  @IsString()
  notificationId: string;
}

export class MarkAllAsReadDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsString()
  userId: string;
} 