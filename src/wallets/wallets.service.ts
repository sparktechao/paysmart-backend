import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Wallet } from '@prisma/client';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallets.dto';
import { AccountType } from '../common/enums/account-type.enum';
import * as bcrypt from 'bcryptjs';

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

  async createWallet(userId: string, createWalletDto: CreateWalletDto): Promise<Wallet> {
    // Validar informações obrigatórias baseadas no accountType
    this.validateWalletData(createWalletDto);

    // Verificar se já existe carteira padrão e se esta deve ser padrão
    if (createWalletDto.isDefault) {
      await this.unsetDefaultWallet(userId);
    } else {
      // Se não especificado e não há carteira padrão, tornar esta padrão
      const existingWallets = await this.prisma.wallet.findMany({
        where: { userId },
      });
      if (existingWallets.length === 0) {
        createWalletDto.isDefault = true;
      }
    }

    // Gerar número da carteira único
    const walletNumber = this.generateWalletNumber();

    // Hash do PIN
    const hashedPin = await bcrypt.hash(createWalletDto.pin, 12);

    // Definir limites baseados no tipo de conta
    const limits = this.getLimitsByAccountType(createWalletDto.accountType);

    return this.prisma.wallet.create({
      data: {
        userId,
        walletNumber,
        accountType: createWalletDto.accountType,
        balances: { AOA: 0, USD: 0, EUR: 0 },
        limits,
        security: {
          pin: hashedPin,
          biometricEnabled: false,
          twoFactorEnabled: false,
          lastPinChange: new Date(),
        },
        isDefault: createWalletDto.isDefault ?? false,
        businessInfo: createWalletDto.businessInfo ? (createWalletDto.businessInfo as any) : null,
        merchantInfo: createWalletDto.merchantInfo ? (createWalletDto.merchantInfo as any) : null,
      },
    });
  }

  async updateWallet(walletId: string, userId: string, updateWalletDto: UpdateWalletDto): Promise<Wallet> {
    const wallet = await this.getWalletById(walletId, userId);

    // Se está definindo como padrão, remover padrão de outras carteiras
    if (updateWalletDto.isDefault === true) {
      await this.unsetDefaultWallet(userId, walletId);
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        isDefault: updateWalletDto.isDefault,
        businessInfo: updateWalletDto.businessInfo !== undefined ? (updateWalletDto.businessInfo as any) : wallet.businessInfo,
        merchantInfo: updateWalletDto.merchantInfo !== undefined ? (updateWalletDto.merchantInfo as any) : wallet.merchantInfo,
      },
    });
  }

  private validateWalletData(dto: CreateWalletDto): void {
    if (dto.accountType === AccountType.BUSINESS && !dto.businessInfo) {
      throw new BadRequestException('Informações da empresa são obrigatórias para contas BUSINESS');
    }

    if (dto.accountType === AccountType.MERCHANT && !dto.merchantInfo) {
      throw new BadRequestException('Informações do merchant são obrigatórias para contas MERCHANT');
    }

    if (dto.accountType === AccountType.BUSINESS && dto.businessInfo) {
      if (!dto.businessInfo.companyName || !dto.businessInfo.taxId) {
        throw new BadRequestException('Nome da empresa e NIF são obrigatórios para contas BUSINESS');
      }
    }

    if (dto.accountType === AccountType.MERCHANT && dto.merchantInfo) {
      if (!dto.merchantInfo.storeName || !dto.merchantInfo.category) {
        throw new BadRequestException('Nome da loja e categoria são obrigatórios para contas MERCHANT');
      }
    }
  }

  private getLimitsByAccountType(accountType: AccountType): Record<string, any> {
    switch (accountType) {
      case AccountType.PERSONAL:
        return {
          dailyTransfer: 50000,
          monthlyTransfer: 500000,
          maxBalance: 1000000,
          minBalance: 0,
        };
      case AccountType.BUSINESS:
        return {
          dailyTransfer: 500000,
          monthlyTransfer: 5000000,
          maxBalance: 10000000,
          minBalance: 0,
        };
      case AccountType.MERCHANT:
        return {
          dailyTransfer: 1000000,
          monthlyTransfer: 10000000,
          maxBalance: 50000000,
          minBalance: 0,
        };
      default:
        return {
          dailyTransfer: 50000,
          monthlyTransfer: 500000,
          maxBalance: 1000000,
          minBalance: 0,
        };
    }
  }

  private async unsetDefaultWallet(userId: string, excludeWalletId?: string): Promise<void> {
    const where: any = { userId, isDefault: true };
    if (excludeWalletId) {
      where.id = { not: excludeWalletId };
    }

    await this.prisma.wallet.updateMany({
      where,
      data: { isDefault: false },
    });
  }

  private generateWalletNumber(): string {
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `PS${randomDigits}`;
  }
} 