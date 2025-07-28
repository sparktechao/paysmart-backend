import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';

export enum Currency {
  AOA = 'AOA',
  USD = 'USD',
  EUR = 'EUR'
}

export enum ServiceType {
  UNITEL = 'UNITEL',
  MOVICEL = 'MOVICEL',
  ZAP = 'ZAP',
  TV_CABO = 'TV_CABO',
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  INTERNET = 'INTERNET',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class PayServiceDto {
  @ApiProperty({ description: 'ID da carteira de origem' })
  @IsString()
  walletId: string;

  @ApiProperty({ description: 'Tipo de serviço', enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Provedor do serviço' })
  @IsString()
  provider: string;

  @ApiProperty({ description: 'Número da conta' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ description: 'Valor a pagar' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Moeda', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Descrição', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'PIN de segurança' })
  @IsString()
  @Min(4)
  @Max(6)
  pin: string;

  @ApiProperty({ description: 'Dados adicionais do serviço', required: false })
  @IsOptional()
  serviceData?: Record<string, any>;
}

export class ServicePaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ServiceType })
  serviceType: ServiceType;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  receiptUrl: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ValidateAccountDto {
  @ApiProperty({ description: 'Tipo de serviço', enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Número da conta' })
  @IsString()
  accountNumber: string;
}

export class AccountValidationResponseDto {
  @ApiProperty()
  isValid: boolean;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  accountName?: string;

  @ApiProperty()
  balance?: number;

  @ApiProperty()
  dueDate?: Date;

  @ApiProperty()
  errorMessage?: string;
}

export class ServiceHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class AvailableServiceDto {
  @ApiProperty()
  type: ServiceType;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  minAmount: number;

  @ApiProperty()
  maxAmount: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  processingTime: string;
} 