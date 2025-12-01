import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsObject, ValidateNested, IsArray, IsEmail, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType } from '../../common/enums/account-type.enum';

export class BusinessInfoDto {
  @ApiProperty({ description: 'Nome da empresa', example: 'Minha Empresa LTDA' })
  @IsString()
  companyName: string;

  @ApiProperty({ description: 'NIF/Número fiscal', example: '123456789' })
  @IsString()
  taxId: string;

  @ApiPropertyOptional({ description: 'Número de registro', example: 'REG123456' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Endereço comercial', example: { street: 'Rua X', city: 'Luanda', province: 'Luanda', postalCode: '1234', country: 'Angola' } })
  @IsOptional()
  @IsObject()
  businessAddress?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Telefone comercial', example: '+244987654321' })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiPropertyOptional({ description: 'Email comercial', example: 'contato@empresa.ao' })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ description: 'IDs de usuários autorizados', example: ['user-id-1', 'user-id-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorizedUsers?: string[];
}

export class MerchantInfoDto {
  @ApiProperty({ description: 'Nome da loja', example: 'Minha Loja' })
  @IsString()
  storeName: string;

  @ApiProperty({ description: 'Categoria do negócio', example: 'Retail' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Descrição do negócio', example: 'Loja de roupas e acessórios' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Se aceita pagamentos via QR Code', example: true, default: false })
  @IsOptional()
  @IsBoolean()
  qrCodeEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Se pode gerar links de pagamento', example: true, default: false })
  @IsOptional()
  @IsBoolean()
  paymentLinkEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Taxa de comissão (se aplicável)', example: 2.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @ApiPropertyOptional({ description: 'ID da carteira para liquidação', example: 'wallet-id' })
  @IsOptional()
  @IsString()
  settlementAccount?: string;
}

export class CreateWalletDto {
  @ApiProperty({ description: 'Tipo de conta', enum: AccountType, default: AccountType.PERSONAL })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiProperty({ description: 'PIN de segurança (4-6 dígitos)' })
  @IsString()
  pin: string;

  @ApiPropertyOptional({ description: 'Informações da empresa (obrigatório se accountType = BUSINESS)', type: BusinessInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessInfoDto)
  businessInfo?: BusinessInfoDto;

  @ApiPropertyOptional({ description: 'Informações do merchant (obrigatório se accountType = MERCHANT)', type: MerchantInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MerchantInfoDto)
  merchantInfo?: MerchantInfoDto;

  @ApiPropertyOptional({ description: 'Se esta é a carteira padrão', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class WalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  walletNumber: string;

  @ApiProperty({ enum: AccountType })
  accountType: AccountType;

  @ApiProperty()
  balances: Record<string, number>;

  @ApiProperty()
  limits: Record<string, any>;

  @ApiProperty()
  status: string;

  @ApiProperty()
  isDefault: boolean;

  @ApiPropertyOptional()
  businessInfo?: Record<string, any>;

  @ApiPropertyOptional()
  merchantInfo?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateWalletDto {
  @ApiPropertyOptional({ description: 'Informações da empresa', type: BusinessInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessInfoDto)
  businessInfo?: BusinessInfoDto;

  @ApiPropertyOptional({ description: 'Informações do merchant', type: MerchantInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MerchantInfoDto)
  merchantInfo?: MerchantInfoDto;

  @ApiPropertyOptional({ description: 'Se esta é a carteira padrão' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

