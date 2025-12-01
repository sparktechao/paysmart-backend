import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletResponseDto } from '../../wallets/dto/wallets.dto';

export class RequestValidationDto {
  @ApiProperty({ description: 'ID do usuário que precisa de validação' })
  @IsString()
  userId: string;
}

export class ValidateUserDto {
  @ApiProperty({ description: 'ID do usuário a ser validado' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], description: 'Status da validação' })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Notas sobre a validação' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nome do usuário' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Sobrenome do usuário' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email do usuário' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Endereço do usuário' })
  @IsOptional()
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };

  @ApiPropertyOptional({ description: 'Preferências do usuário' })
  @IsOptional()
  preferences?: {
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      shareData: boolean;
      marketing: boolean;
    };
  };
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  userType: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  validationScore: number;

  @ApiProperty()
  validators: string[];

  @ApiPropertyOptional({ description: 'Carteira padrão do usuário', type: WalletResponseDto })
  defaultWallet?: WalletResponseDto;

  @ApiPropertyOptional({ description: 'Todas as carteiras do usuário', type: [WalletResponseDto] })
  wallets?: WalletResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ValidationRequestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  validatorId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  user: {
    firstName: string;
    lastName: string;
    phone: string;
  };
} 