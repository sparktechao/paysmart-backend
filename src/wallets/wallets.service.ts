import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface WalletResponseDto {
  id: string;
  walletNumber: string;
  balances: Record<string, number>;
  limits: Record<string, any>;
  status: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

    return wallets.map(wallet => ({
      id: wallet.id,
      walletNumber: wallet.walletNumber,
      balances: wallet.balances as Record<string, number>,
      limits: wallet.limits as Record<string, any>,
      status: wallet.status,
      isDefault: wallet.isDefault,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }));
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

    return {
      id: wallet.id,
      walletNumber: wallet.walletNumber,
      balances: wallet.balances as Record<string, number>,
      limits: wallet.limits as Record<string, any>,
      status: wallet.status,
      isDefault: wallet.isDefault,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
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

  async createWallet(userId: string, data: any): Promise<WalletResponseDto> {
    // Verificar se o usuário já tem o máximo de carteiras permitidas
    const existingWallets = await this.prisma.wallet.count({
      where: { userId },
    });

    if (existingWallets >= 5) {
      throw new BadRequestException('Máximo de 5 carteiras permitidas por usuário');
    }

    // Gerar número da carteira único
    const walletNumber = this.generateWalletNumber();

    // Verificar se o número já existe
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { walletNumber },
    });

    if (existingWallet) {
      // Se existir, gerar novo número
      return this.createWallet(userId, data);
    }

    const wallet = await this.prisma.wallet.create({
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

    return {
      id: wallet.id,
      walletNumber: wallet.walletNumber,
      balances: wallet.balances as Record<string, number>,
      limits: wallet.limits as Record<string, any>,
      status: wallet.status,
      isDefault: wallet.isDefault,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
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

    return {
      id: wallet.id,
      walletNumber: wallet.walletNumber,
      balances: wallet.balances as Record<string, number>,
      limits: wallet.limits as Record<string, any>,
      status: wallet.status,
      isDefault: wallet.isDefault,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
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

    return {
      id: result.id,
      walletNumber: result.walletNumber,
      balances: result.balances as Record<string, number>,
      limits: result.limits as Record<string, any>,
      status: result.status,
      isDefault: result.isDefault,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
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

  private generateWalletNumber(): string {
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `PS${randomDigits}`;
  }
} 