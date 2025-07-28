import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Wallet } from '@prisma/client';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async getWalletById(walletId: string, userId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    return wallet;
  }

  async getWalletBalance(walletId: string, userId: string): Promise<any> {
    const wallet = await this.getWalletById(walletId, userId);
    return wallet.balances;
  }

  async createWallet(userId: string, data: any): Promise<Wallet> {
    // Gerar número da carteira único
    const walletNumber = this.generateWalletNumber();

    return this.prisma.wallet.create({
      data: {
        userId,
        walletNumber,
        balances: { AOA: 0, USD: 0, EUR: 0 },
        limits: {
          dailyTransfer: 50000,
          monthlyTransfer: 500000,
          maxBalance: 1000000,
          minBalance: 0,
        },
        security: {
          pin: data.pin,
          biometricEnabled: false,
          twoFactorEnabled: false,
          lastPinChange: new Date(),
        },
        isDefault: false,
      },
    });
  }

  private generateWalletNumber(): string {
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `PS${randomDigits}`;
  }
} 