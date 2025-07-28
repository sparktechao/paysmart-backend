import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';

export enum SharedWalletStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

export enum Permission {
  VIEW = 'VIEW',
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  TRANSFER = 'TRANSFER',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS'
}

export class CreateSharedWalletDto {
  @ApiProperty({ description: 'Nome da carteira compartilhada' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descrição da carteira' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Moeda da carteira' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Limite mínimo para transações' })
  @IsNumber()
  @Min(0)
  minTransactionAmount: number;

  @ApiProperty({ description: 'Limite máximo para transações' })
  @IsNumber()
  @Min(0)
  maxTransactionAmount: number;

  @ApiProperty({ description: 'Membros iniciais da carteira' })
  @IsArray()
  members: SharedWalletMemberDto[];

  @ApiProperty({ description: 'Configurações da carteira', required: false })
  @IsOptional()
  settings?: Record<string, any>;
}

export class SharedWalletMemberDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Papel do membro' })
  @IsString()
  role: 'ADMIN' | 'MEMBER';

  @ApiProperty({ description: 'Permissões do membro' })
  @IsArray()
  permissions: Permission[];

  @ApiProperty({ description: 'Limite de transação para o membro', required: false })
  @IsOptional()
  @IsNumber()
  transactionLimit?: number;
}

export class SharedWalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  balance: number;

  @ApiProperty({ enum: SharedWalletStatus })
  status: SharedWalletStatus;

  @ApiProperty()
  minTransactionAmount: number;

  @ApiProperty()
  maxTransactionAmount: number;

  @ApiProperty()
  walletNumber: string;

  @ApiProperty()
  members: SharedWalletMemberResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  settings?: Record<string, any>;
}

export class SharedWalletMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  userEmail: string;

  @ApiProperty({ enum: MemberRole })
  role: MemberRole;

  @ApiProperty()
  permissions: Permission[];

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ required: false })
  transactionLimit?: number;
}

export class AddMemberDto {
  @ApiProperty({ description: 'ID do novo membro' })
  @IsString()
  newMemberId: string;

  @ApiProperty({ description: 'Papel do membro', enum: MemberRole })
  @IsEnum(MemberRole)
  role: MemberRole;

  @ApiProperty({ description: 'Permissões do membro' })
  permissions: {
    canSend: boolean;
    canReceive: boolean;
    canView: boolean;
    canManage: boolean;
  };
}

export class UpdateMemberDto {
  @ApiProperty({ description: 'Papel do membro', required: false })
  @IsOptional()
  @IsString()
  role?: 'ADMIN' | 'MEMBER';

  @ApiProperty({ description: 'Permissões do membro', required: false })
  @IsOptional()
  permissions?: {
    canSend: boolean;
    canReceive: boolean;
    canView: boolean;
    canManage: boolean;
  };

  @ApiProperty({ description: 'Limite de transação para o membro', required: false })
  @IsOptional()
  @IsNumber()
  transactionLimit?: number;
}

export class SharedWalletFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SharedWalletStatus)
  status?: SharedWalletStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;
} 