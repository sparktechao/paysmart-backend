import { IsString, IsEmail, IsOptional, MinLength, Matches, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Número de telefone do usuário' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'PIN da carteira' })
  @IsString()
  @MinLength(4)
  pin: string;
}

export class RegisterDto {
  @ApiProperty({ description: 'Número de telefone do usuário' })
  @IsString()
  @Matches(/^\+244[0-9]{9}$/, { message: 'Telefone deve estar no formato +244XXXXXXXXX' })
  phone: string;

  @ApiPropertyOptional({ description: 'Email do usuário' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Nome do usuário' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Sobrenome do usuário' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Data de nascimento' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: ['MALE', 'FEMALE', 'OTHER'], description: 'Gênero do usuário' })
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiProperty({ enum: ['BI', 'PASSPORT', 'DRIVER_LICENSE'], description: 'Tipo de documento' })
  @IsEnum(['BI', 'PASSPORT', 'DRIVER_LICENSE'])
  documentType: 'BI' | 'PASSPORT' | 'DRIVER_LICENSE';

  @ApiProperty({ description: 'Número do documento' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ description: 'Data de expiração do documento' })
  @IsDateString()
  documentExpiry: string;

  @ApiProperty({ description: 'PIN da carteira (mínimo 4 dígitos)' })
  @IsString()
  @MinLength(4)
  pin: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refreshToken: string;
}

export class ChangePinDto {
  @ApiProperty({ description: 'PIN atual' })
  @IsString()
  @MinLength(4)
  currentPin: string;

  @ApiProperty({ description: 'Novo PIN' })
  @IsString()
  @MinLength(4)
  newPin: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    phone: string;
    firstName: string;
    lastName: string;
    userType: string;
    status: string;
  };
} 