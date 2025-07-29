import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min, Length, ValidateIf, IsPhoneNumber } from 'class-validator';
import { TransactionType, TransactionStatus, Currency } from '../../common/enums/transaction.enum';

export class CreateTransactionDto {
  @ApiProperty({ description: 'ID da carteira de origem (opcional para DEPOSIT)' })
  @IsOptional()
  @IsString()
  fromWalletId?: string;

  @ApiProperty({ 
    description: 'ID da carteira de destino (opcional para WITHDRAWAL). Não usar junto com toPhone',
    required: false
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.toPhone)
  toWalletId?: string;

  @ApiProperty({ 
    description: 'Número de telefone do usuário de destino (alternativa ao toWalletId). Sistema usará a carteira padrão',
    required: false,
    example: '+244987654321'
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.toWalletId)
  toPhone?: string;

  @ApiProperty({ description: 'ID do usuário de origem (opcional para DEPOSIT)' })
  @IsOptional()
  @IsString()
  fromUserId?: string;

  @ApiProperty({ description: 'ID do usuário de destino (opcional para WITHDRAWAL)' })
  @IsOptional()
  @IsString()
  toUserId?: string;

  @ApiProperty({ description: 'Valor da transação' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Moeda da transação', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Descrição da transação' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'PIN de segurança' })
  @IsString()
  @Length(4, 6)
  pin: string;

  @ApiProperty({ description: 'Tipo de transação', enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: 'Dados adicionais da transação', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromWalletId: string;

  @ApiProperty()
  toWalletId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}

export class TransactionFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxAmount?: number;
}

export class TransactionStatsDto {
  @ApiProperty()
  totalTransactions: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  averageAmount: number;

  @ApiProperty()
  completedTransactions: number;

  @ApiProperty()
  pendingTransactions: number;

  @ApiProperty()
  failedTransactions: number;
} 