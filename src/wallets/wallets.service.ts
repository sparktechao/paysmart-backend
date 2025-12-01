import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Wallet } from '@prisma/client';
import { CreateWalletDto, UpdateWalletDto, WalletResponseDto } from './dto/wallets.dto';
import { AccountType } from '../common/enums/account-type.enum';
import * as bcrypt from 'bcryptjs';

export interface WalletBalanceDto {
  walletId: string;
  walletNumber: string;
  balances: Record<string, number>;
  totalBalance: Record<string, number>;
}

export interface WalletTransactionDto {
  id: string;
  reference: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  fromWalletId?: string;
  toWalletId?: string;
  fromUserId?: string;
  toUserId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionsResponseDto {
  walletId: string;
  walletNumber: string;
  transactions: WalletTransactionDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async getUserWallets(userId: string): Promise<WalletResponseDto[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });

    return wallets.map(wallet => this.formatWalletResponse(wallet));
  }

  private formatWalletResponse(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      userId: wallet.userId,
      walletNumber: wallet.walletNumber,
      accountType: wallet.accountType as AccountType,
      balances: wallet.balances as Record<string, number>,
      limits: wallet.limits as Record<string, any>,
      status: wallet.status,
      isDefault: wallet.isDefault,
      businessInfo: wallet.businessInfo as Record<string, any> | undefined,
      merchantInfo: wallet.merchantInfo as Record<string, any> | undefined,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  async getWalletById(walletId: string, userId: string): Promise<WalletResponseDto> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada ou não pertence ao usuário');
    }

    return this.formatWalletResponse(wallet);
  }

  async getWalletBalance(walletId: string, userId: string): Promise<WalletBalanceDto> {
    const wallet = await this.getWalletById(walletId, userId);
    
    const balances = wallet.balances;
    const totalBalance = {
      AOA: balances.AOA || 0,
      USD: balances.USD || 0,
      EUR: balances.EUR || 0,
    };

    return {
      walletId: wallet.id,
      walletNumber: wallet.walletNumber,
      balances,
      totalBalance,
    };
  }

  async createWallet(userId: string, createWalletDto: CreateWalletDto): Promise<WalletResponseDto> {
    // Verificar se o usuário já tem o máximo de carteiras permitidas
    const existingWallets = await this.prisma.wallet.count({
      where: { userId },
    });

    if (existingWallets >= 5) {
      throw new BadRequestException('Máximo de 5 carteiras permitidas por usuário');
    }

    // Validar informações obrigatórias baseadas no accountType
    this.validateWalletData(createWalletDto);

    // Verificar se já existe carteira padrão e se esta deve ser padrão
    if (createWalletDto.isDefault) {
      await this.unsetDefaultWallet(userId);
    } else {
      // Se não especificado e não há carteira padrão, tornar esta padrão
      if (existingWallets === 0) {
        createWalletDto.isDefault = true;
      }
    }

    // Gerar número da carteira único
    let walletNumber = this.generateWalletNumber();
    
    // Verificar se o número já existe e gerar novo se necessário
    let existingWallet = await this.prisma.wallet.findUnique({
      where: { walletNumber },
    });
    
    while (existingWallet) {
      walletNumber = this.generateWalletNumber();
      existingWallet = await this.prisma.wallet.findUnique({
        where: { walletNumber },
      });
    }

    // Hash do PIN
    const hashedPin = await bcrypt.hash(createWalletDto.pin, 12);

    // Definir limites baseados no tipo de conta
    const limits = this.getLimitsByAccountType(createWalletDto.accountType);

    const wallet = await this.prisma.wallet.create({
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

    return this.formatWalletResponse(wallet);
  }

  async getDefaultWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira padrão não encontrada');
    }

    return this.formatWalletResponse(wallet);
  }

  async setDefaultWallet(walletId: string, userId: string): Promise<WalletResponseDto> {
    // Verificar se a carteira existe e pertence ao usuário
    const targetWallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    if (!targetWallet) {
      throw new NotFoundException('Carteira não encontrada ou não pertence ao usuário');
    }

    // Verificar se a carteira já é a padrão
    if (targetWallet.isDefault) {
      throw new BadRequestException('Esta carteira já é a padrão');
    }

    // Verificar se a carteira está ativa
    if (targetWallet.status !== 'ACTIVE') {
      throw new BadRequestException('Apenas carteiras ativas podem ser definidas como padrão');
    }

    // Executar transação para atualizar todas as carteiras
    const result = await this.prisma.$transaction(async (prisma) => {
      // Remover flag padrão de todas as carteiras do usuário
      await prisma.wallet.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      // Definir a carteira selecionada como padrão
      const updatedWallet = await prisma.wallet.update({
        where: {
          id: walletId,
        },
        data: {
          isDefault: true,
        },
      });

      return updatedWallet;
    });

    return this.formatWalletResponse(result);
  }

  async getWalletTransactions(
    walletId: string, 
    userId: string, 
    filters: any = {}
  ): Promise<WalletTransactionsResponseDto> {
    // Verificar se a carteira existe e pertence ao usuário
    const wallet = await this.getWalletById(walletId, userId);

    // Construir filtros de consulta
    const where: any = {
      OR: [
        { fromWalletId: walletId },
        { toWalletId: walletId }
      ]
    };

    // Aplicar filtros opcionais
    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.currency) {
      where.currency = filters.currency;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Configurar paginação
    const limit = parseInt(filters.limit) || 20;
    const offset = parseInt(filters.offset) || 0;
    const page = Math.floor(offset / limit) + 1;

    // Buscar transações
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          fromWallet: true,
          toWallet: true,
          fromUser: true,
          toUser: true,
        },
      }),
      this.prisma.transaction.count({ where })
    ]);

    // Mapear transações para DTO
    const transactionDtos: WalletTransactionDto[] = transactions.map(tx => ({
      id: tx.id,
      reference: tx.reference,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      status: tx.status,
      fromWalletId: tx.fromWalletId || undefined,
      toWalletId: tx.toWalletId || undefined,
      fromUserId: tx.fromUserId || undefined,
      toUserId: tx.toUserId || undefined,
      metadata: tx.metadata as Record<string, any>,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }));

    return {
      walletId: wallet.id,
      walletNumber: wallet.walletNumber,
      transactions: transactionDtos,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async updateWallet(walletId: string, userId: string, updateWalletDto: UpdateWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.getWalletById(walletId, userId);

    // Se está definindo como padrão, remover padrão de outras carteiras
    if (updateWalletDto.isDefault === true) {
      await this.unsetDefaultWallet(userId, walletId);
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        isDefault: updateWalletDto.isDefault,
        businessInfo: updateWalletDto.businessInfo !== undefined ? (updateWalletDto.businessInfo as any) : wallet.businessInfo,
        merchantInfo: updateWalletDto.merchantInfo !== undefined ? (updateWalletDto.merchantInfo as any) : wallet.merchantInfo,
      },
    });

    return this.formatWalletResponse(updatedWallet);
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