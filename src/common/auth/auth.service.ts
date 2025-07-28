import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePinDto, AuthResponseDto } from './dto/auth.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { phone, pin, ...userData } = registerDto;

    // Verificar se o telefone já existe
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      throw new BadRequestException('Telefone já registrado');
    }

    // Hash do PIN
    const hashedPin = await bcrypt.hash(pin, 12);

    // Criar usuário e carteira padrão
    const user = await this.prisma.$transaction(async (prisma) => {
      const newUser = await prisma.user.create({
        data: {
          ...userData,
          phone,
          userType: 'BASIC',
          status: 'PENDING',
        },
      });

      // Gerar número da carteira único
      const walletNumber = this.generateWalletNumber();

      // Criar carteira padrão
      const wallet = await prisma.wallet.create({
        data: {
          userId: newUser.id,
          walletNumber,
          balances: { AOA: 0, USD: 0, EUR: 0 },
          limits: {
            dailyTransfer: 50000,
            monthlyTransfer: 500000,
            maxBalance: 1000000,
            minBalance: 0,
          },
          security: {
            pin: hashedPin,
            biometricEnabled: false,
            twoFactorEnabled: false,
            lastPinChange: new Date(),
          },
          isDefault: true,
        },
      });

      return { ...newUser, wallet };
    });

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.phone);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        status: user.status,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { phone, pin } = loginDto;

    // Buscar usuário com carteira
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        wallets: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    if (!user || !user.wallets[0]) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar PIN
    const wallet = user.wallets[0];
    const security = wallet.security as any;
    const isPinValid = await bcrypt.compare(pin, security.pin as string);

    if (!isPinValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se usuário está ativo
    if (user.status !== 'ACTIVE' && user.status !== 'PREMIUM_PENDING') {
      throw new UnauthorizedException('Conta não está ativa');
    }

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.phone);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        status: user.status,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      const tokens = await this.generateTokens(user.id, user.phone);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          status: user.status,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async changePin(userId: string, changePinDto: ChangePinDto): Promise<{ message: string }> {
    const { currentPin, newPin } = changePinDto;

    // Buscar carteira do usuário
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isDefault: true },
    });

    if (!wallet) {
      throw new BadRequestException('Carteira não encontrada');
    }

    // Verificar PIN atual
    const security = wallet.security as any;
    const isCurrentPinValid = await bcrypt.compare(currentPin, security.pin as string);

    if (!isCurrentPinValid) {
      throw new BadRequestException('PIN atual incorreto');
    }

    // Hash do novo PIN
    const hashedNewPin = await bcrypt.hash(newPin, 12);

    // Atualizar PIN
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        security: {
          ...(wallet.security as any),
          pin: hashedNewPin,
          lastPinChange: new Date(),
        },
      },
    });

    return { message: 'PIN alterado com sucesso' };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  private async generateTokens(userId: string, phone: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          phone,
        },
        {
          secret: this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          phone,
        },
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private generateWalletNumber(): string {
    // Gerar número da carteira no formato: PS + 10 dígitos aleatórios
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `PS${randomDigits}`;
  }
} 