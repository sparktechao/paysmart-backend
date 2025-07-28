import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { RequestStatus, RequestCategory } from '@prisma/client';

export class CreatePaymentRequestDto {
  @ApiProperty({ description: 'ID do usuário que receberá o pagamento' })
  @IsString()
  payerId: string;

  @ApiProperty({ description: 'Valor solicitado' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Descrição da solicitação' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Categoria da solicitação', enum: RequestCategory, required: false })
  @IsOptional()
  @IsEnum(RequestCategory)
  category?: RequestCategory;

  @ApiProperty({ description: 'Data de expiração', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ description: 'Dados adicionais', required: false })
  @IsOptional()
  metadata?: any;
}

export class PaymentRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requesterId: string;

  @ApiProperty()
  payerId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty({ enum: RequestCategory })
  category: RequestCategory;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty({ required: false })
  paidAt?: Date;

  @ApiProperty({ required: false })
  metadata?: any;
}

export class PaymentRequestFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(RequestCategory)
  category?: RequestCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
} 