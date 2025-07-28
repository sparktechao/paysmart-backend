import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsArray, IsDateString, Min, Length } from 'class-validator';

export enum RateioStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum ParticipantStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
  PAID = 'PAID'
}

export class CreateRateioDto {
  @ApiProperty({ description: 'ID da carteira de origem' })
  @IsString()
  fromWalletId: string;

  @ApiProperty({ description: 'ID da carteira de destino' })
  @IsString()
  toWalletId: string;

  @ApiProperty({ description: 'Valor total do rateio' })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiProperty({ description: 'Descrição do rateio' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Participantes do rateio' })
  @IsArray()
  participants: ParticipantDto[];

  @ApiProperty({ description: 'Data de execução', required: false })
  @IsOptional()
  @IsDateString()
  scheduleDate?: string;

  @ApiProperty({ description: 'PIN de segurança' })
  @IsString()
  @Length(4, 6)
  pin: string;

  @ApiProperty({ description: 'Dados adicionais', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ParticipantDto {
  @ApiProperty({ description: 'ID do usuário participante' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Valor da contribuição' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Mensagem para o participante', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

export class RateioResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromWalletId: string;

  @ApiProperty()
  toWalletId: string;

  @ApiProperty()
  fromUserId: string;

  @ApiProperty()
  toUserId: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: RateioStatus })
  status: RateioStatus;

  @ApiProperty()
  participants: ParticipantResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  scheduleDate?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}

export class ParticipantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: ParticipantStatus })
  status: ParticipantStatus;

  @ApiProperty()
  confirmedAt?: Date;

  @ApiProperty()
  paidAt?: Date;

  @ApiProperty({ required: false })
  message?: string;
}

export class ConfirmRateioDto {
  @ApiProperty({ description: 'ID do participante' })
  @IsString()
  participantId: string;

  @ApiProperty({ description: 'Comentário da confirmação', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RateioFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(RateioStatus)
  status?: RateioStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
} 