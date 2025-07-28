import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsArray, IsDateString, Min, Max } from 'class-validator';

export enum Currency {
  AOA = 'AOA',
  USD = 'USD',
  EUR = 'EUR'
}

export enum SmartContractType {
  CONDITIONAL = 'CONDITIONAL',
  TIMED = 'TIMED',
  MULTI_PARTY = 'MULTI_PARTY',
  ESCROW = 'ESCROW'
}

export enum SmartContractStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum ConditionType {
  MANUAL_CONFIRMATION = 'MANUAL_CONFIRMATION',
  TIME_BASED = 'TIME_BASED',
  AMOUNT_THRESHOLD = 'AMOUNT_THRESHOLD',
  MULTIPLE_CONFIRMATIONS = 'MULTIPLE_CONFIRMATIONS'
}

export class CreateSmartContractDto {
  @ApiProperty({ description: 'ID da carteira de origem' })
  @IsString()
  fromWalletId: string;

  @ApiProperty({ description: 'ID da carteira de destino' })
  @IsString()
  toWalletId: string;

  @ApiProperty({ description: 'Valor do contrato' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Moeda do contrato', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Descrição do contrato' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Tipo do smart contract', enum: SmartContractType })
  @IsEnum(SmartContractType)
  type: SmartContractType;

  @ApiProperty({ description: 'Condições do contrato' })
  @IsArray()
  conditions: ConditionDto[];

  @ApiProperty({ description: 'Data de expiração', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ description: 'PIN de segurança' })
  @IsString()
  @Min(4)
  @Max(6)
  pin: string;

  @ApiProperty({ description: 'Dados adicionais', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ConditionDto {
  @ApiProperty({ description: 'Tipo da condição', enum: ConditionType })
  @IsEnum(ConditionType)
  type: ConditionType;

  @ApiProperty({ description: 'Detalhes da condição' })
  details: Record<string, any>;

  @ApiProperty({ description: 'Ordem da condição' })
  @IsNumber()
  order: number;
}

export class SmartContractResponseDto {
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
  amount: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: SmartContractType })
  type: SmartContractType;

  @ApiProperty({ enum: SmartContractStatus })
  status: SmartContractStatus;

  @ApiProperty()
  conditions: ConditionDto[];

  @ApiProperty({ required: false })
  confirmations?: any[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}

export class ConfirmConditionDto {
  @ApiProperty({ description: 'ID da condição' })
  @IsString()
  conditionId: string;

  @ApiProperty({ description: 'Comentário da confirmação', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class SmartContractFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SmartContractType)
  type?: SmartContractType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SmartContractStatus)
  status?: SmartContractStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
} 