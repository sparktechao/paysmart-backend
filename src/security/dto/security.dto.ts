import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum FraudType {
  SUSPICIOUS_TRANSACTION = 'SUSPICIOUS_TRANSACTION',
  MULTIPLE_ACCOUNTS = 'MULTIPLE_ACCOUNTS',
  UNUSUAL_ACTIVITY = 'UNUSUAL_ACTIVITY',
  IDENTITY_THEFT = 'IDENTITY_THEFT',
  MONEY_LAUNDERING = 'MONEY_LAUNDERING',
  OTHER = 'OTHER'
}

export enum SecurityLogType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TRANSACTION = 'TRANSACTION',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PIN_CHANGE = 'PIN_CHANGE',
  ACCOUNT_LOCK = 'ACCOUNT_LOCK',
  ACCOUNT_UNLOCK = 'ACCOUNT_UNLOCK',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class ReportFraudDto {
  @ApiProperty({ description: 'Tipo de fraude', enum: FraudType })
  @IsEnum(FraudType)
  type: FraudType;

  @ApiProperty({ description: 'Descrição da fraude' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'ID da transação suspeita', required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'ID do usuário suspeito', required: false })
  @IsOptional()
  @IsString()
  suspectUserId?: string;

  @ApiProperty({ description: 'Evidências adicionais', required: false })
  @IsOptional()
  evidence?: Record<string, any>;
}

export class FraudReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reporterId: string;

  @ApiProperty({ enum: FraudType })
  type: FraudType;

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  transactionId?: string;

  @ApiProperty({ required: false })
  suspectUserId?: string;

  @ApiProperty({ required: false })
  evidence?: Record<string, any>;
}

export class SecurityLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: SecurityLogType })
  type: SecurityLogType;

  @ApiProperty({ enum: SecurityLevel })
  level: SecurityLevel;

  @ApiProperty()
  description: string;

  @ApiProperty()
  ipAddress: string;

  @ApiProperty()
  userAgent: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}

export class SuspiciousActivityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  activityType: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: SecurityLevel })
  riskLevel: SecurityLevel;

  @ApiProperty()
  detectedAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  resolvedAt?: Date;
}

export class SecurityFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SecurityLogType)
  type?: SecurityLogType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SecurityLevel)
  level?: SecurityLevel;

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
  @IsString()
  userId?: string;
}

export class LockAccountDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Motivo do bloqueio' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Duração do bloqueio em horas', required: false })
  @IsOptional()
  @IsNumber()
  durationHours?: number;
}

export class UnlockAccountDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Motivo do desbloqueio' })
  @IsString()
  reason: string;
} 