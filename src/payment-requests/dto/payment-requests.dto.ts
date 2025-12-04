import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min, Length } from 'class-validator';
import { RequestStatus, RequestCategory } from '@prisma/client';

export class CreatePaymentRequestDto {
  @ApiPropertyOptional({ 
    description: 'ID do usuário (UUID) ou número de telefone (+244XXXXXXXXX) que receberá o pagamento. Se não fornecido, cria um payment link público (qualquer um pode pagar)',
    example: 'cabeb799-d9da-4305-8cb6-6f583da0bf1f ou +244555666777'
  })
  @IsOptional()
  @IsString()
  payerId?: string;

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

  @ApiPropertyOptional({ 
    description: 'Dados para gerar QR code no frontend (apenas se requester for MERCHANT com QR habilitado)',
    example: {
      paymentUrl: 'http://localhost:3000/payment/123',
      qrOptions: {
        size: 300,
        margin: 2,
        errorCorrectionLevel: 'M'
      },
      merchantInfo: {
        storeName: 'Loja Exemplo',
        category: 'Retail'
      }
    }
  })
  qrData?: {
    paymentUrl: string;
    qrOptions?: {
      size?: number;
      margin?: number;
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    };
    merchantInfo?: {
      storeName?: string;
      category?: string;
    };
  };
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

export class ApprovePaymentRequestDto {
  @ApiProperty({ description: 'PIN de segurança da carteira', example: '1234' })
  @IsString()
  @Length(4, 6)
  pin: string;
}

export class PaymentQRDataDto {
  @ApiProperty({ description: 'URL do pagamento para gerar QR code' })
  paymentUrl: string;

  @ApiProperty({ description: 'ID do pedido de pagamento' })
  paymentRequestId: string;

  @ApiProperty({ description: 'Valor do pagamento' })
  amount: number;

  @ApiProperty({ description: 'Moeda do pagamento' })
  currency: string;

  @ApiProperty({ description: 'Descrição do pagamento' })
  description: string;

  @ApiProperty({ description: 'Data de expiração', required: false })
  expiresAt?: Date;

  @ApiProperty({ description: 'Informações do merchant', required: false })
  merchantInfo?: {
    storeName?: string;
    category?: string;
  };

  @ApiProperty({ 
    description: 'Opções para geração do QR code no frontend',
    required: false,
    example: {
      size: 300,
      margin: 2,
      errorCorrectionLevel: 'M'
    }
  })
  qrOptions?: {
    size?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };
} 