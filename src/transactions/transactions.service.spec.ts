import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionType, Currency } from '../common/enums/transaction.enum';
import * as bcrypt from 'bcryptjs';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    wallet: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  describe('createTransaction - TRANSFER', () => {
    const transactionData = {
      fromWalletId: '123e4567-e89b-12d3-a456-426614174000',
      toWalletId: '123e4567-e89b-12d3-a456-426614174001',
      fromUserId: '123e4567-e89b-12d3-a456-426614174002',
      toUserId: '123e4567-e89b-12d3-a456-426614174003',
      type: TransactionType.TRANSFER,
      amount: 100,
      currency: Currency.AOA,
      description: 'Test transfer',
      pin: '1234',
    };

    let mockFromWallet: any;

    beforeAll(async () => {
      mockFromWallet = {
        id: transactionData.fromWalletId,
        userId: transactionData.fromUserId,
        balances: { AOA: 500, USD: 0, EUR: 0 },
        security: {
          pin: await bcrypt.hash('1234', 12),
        },
      };
    });

    const mockToWallet = {
      id: transactionData.toWalletId,
      userId: transactionData.toUserId,
      balances: { AOA: 100, USD: 0, EUR: 0 },
    };

    it('deve criar transferência com sucesso', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(mockFromWallet)
              .mockResolvedValueOnce(mockToWallet),
            update: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...transactionData,
              reference: 'REF123',
              status: 'PROCESSING',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...transactionData,
              reference: 'REF123',
              status: 'COMPLETED',
              createdAt: new Date(),
              updatedAt: new Date(),
              processedAt: new Date(),
              completedAt: new Date(),
            }),
          },
        };
        return callback(mockPrisma);
      });

      const result = await service.createTransaction(transactionData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('COMPLETED');
    });

    it('deve lançar erro se saldo insuficiente', async () => {
      const walletWithLowBalance = {
        ...mockFromWallet,
        balances: { AOA: 50, USD: 0, EUR: 0 },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(walletWithLowBalance)
              .mockResolvedValueOnce(mockToWallet),
          },
        };
        return callback(mockPrisma);
      });

      await expect(service.createTransaction(transactionData)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se PIN estiver incorreto', async () => {
      const walletWithWrongPin = {
        ...mockFromWallet,
        security: {
          pin: await bcrypt.hash('wrong-pin', 12),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(walletWithWrongPin)
              .mockResolvedValueOnce(mockToWallet),
          },
        };
        return callback(mockPrisma);
      });

      await expect(service.createTransaction(transactionData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTransaction - DEPOSIT', () => {
    const depositData = {
      toWalletId: '123e4567-e89b-12d3-a456-426614174010',
      toUserId: '123e4567-e89b-12d3-a456-426614174011',
      type: TransactionType.DEPOSIT,
      amount: 200,
      currency: Currency.AOA,
      description: 'Deposit',
    };

    const mockToWallet = {
      id: depositData.toWalletId,
      userId: depositData.toUserId,
      balances: { AOA: 100, USD: 0, EUR: 0 },
    };

    it('deve criar depósito com sucesso', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn().mockResolvedValueOnce(mockToWallet),
            update: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...depositData,
              reference: 'REF123',
              status: 'PROCESSING',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...depositData,
              reference: 'REF123',
              status: 'COMPLETED',
              createdAt: new Date(),
              updatedAt: new Date(),
              processedAt: new Date(),
              completedAt: new Date(),
            }),
          },
        };
        return callback(mockPrisma);
      });

      const result = await service.createTransaction(depositData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('createTransaction - WITHDRAWAL', () => {
    const withdrawalData = {
      fromWalletId: '123e4567-e89b-12d3-a456-426614174020',
      fromUserId: '123e4567-e89b-12d3-a456-426614174021',
      type: TransactionType.WITHDRAWAL,
      amount: 50,
      currency: Currency.AOA,
      description: 'Withdrawal',
      pin: '1234',
    };

    let mockFromWallet: any;

    beforeAll(async () => {
      mockFromWallet = {
        id: withdrawalData.fromWalletId,
        userId: withdrawalData.fromUserId,
        balances: { AOA: 500, USD: 0, EUR: 0 },
        security: {
          pin: await bcrypt.hash('1234', 12),
        },
      };
    });

    it('deve criar saque com sucesso', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn().mockResolvedValueOnce(mockFromWallet),
            update: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...withdrawalData,
              reference: 'REF123',
              status: 'PROCESSING',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...withdrawalData,
              reference: 'REF123',
              status: 'COMPLETED',
              createdAt: new Date(),
              updatedAt: new Date(),
              processedAt: new Date(),
              completedAt: new Date(),
            }),
          },
        };
        return callback(mockPrisma);
      });

      const result = await service.createTransaction(withdrawalData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('createTransaction - com toPhone', () => {
    const transactionData = {
      fromWalletId: '123e4567-e89b-12d3-a456-426614174030',
      fromUserId: '123e4567-e89b-12d3-a456-426614174031',
      toUserId: '123e4567-e89b-12d3-a456-426614174032', // Será usado após resolução
      toPhone: '+244987654321',
      type: TransactionType.TRANSFER,
      amount: 100,
      currency: Currency.AOA,
      description: 'Transfer by phone',
      pin: '1234',
    };

    let mockFromWallet: any;

    beforeAll(async () => {
      mockFromWallet = {
        id: transactionData.fromWalletId,
        userId: transactionData.fromUserId,
        balances: { AOA: 500, USD: 0, EUR: 0 },
        security: {
          pin: await bcrypt.hash('1234', 12),
        },
      };
    });

    const mockToWallet = {
      id: '123e4567-e89b-12d3-a456-426614174032',
      userId: '123e4567-e89b-12d3-a456-426614174033',
      walletNumber: 'PS9876543210',
      balances: { AOA: 100, USD: 0, EUR: 0 },
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174033',
      phone: '+244987654321',
      status: 'ACTIVE',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('deve resolver telefone para carteira padrão', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockToWallet);

      // Simular que o resolvePhoneToDefaultWallet será chamado e atualizará os dados
      const transactionDataWithResolved = {
        ...transactionData,
        toWalletId: mockToWallet.id,
        toUserId: mockToWallet.userId,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          wallet: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(mockFromWallet)
              .mockResolvedValueOnce(mockToWallet),
            update: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              ...transactionDataWithResolved,
              reference: 'REF123',
              status: 'PROCESSING',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'transaction-123',
              reference: 'REF123',
              fromWalletId: transactionData.fromWalletId,
              toWalletId: transactionDataWithResolved.toWalletId,
              fromUserId: transactionData.fromUserId,
              toUserId: transactionDataWithResolved.toUserId,
              type: transactionData.type,
              amount: transactionData.amount,
              currency: transactionData.currency,
              description: transactionData.description,
              status: 'COMPLETED',
              processedAt: new Date(),
              completedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        };
        return callback(mockPrisma);
      });

      const result = await service.createTransaction(transactionData);

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { phone: transactionData.toPhone },
        select: { id: true, firstName: true, lastName: true, status: true },
      });
      expect(mockPrismaService.wallet.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isDefault: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          userId: true,
          walletNumber: true,
          status: true,
        },
      });
    });

    it('deve lançar erro se usuário com telefone não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // O erro será NotFoundException do resolvePhoneToDefaultWallet
      await expect(service.createTransaction(transactionData)).rejects.toThrow();
    });
  });

  describe('getTransactionHistory', () => {
    const userId = 'user-123';
    const mockTransactions = [
      {
        id: 'transaction-1',
        fromUserId: userId,
        amount: 100,
        currency: Currency.AOA,
        type: TransactionType.TRANSFER,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
        reference: 'REF001',
        description: 'Test',
      },
      {
        id: 'transaction-2',
        toUserId: userId,
        amount: 50,
        currency: Currency.AOA,
        type: TransactionType.TRANSFER,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
        reference: 'REF002',
        description: 'Test',
      },
    ];

    it('deve retornar histórico de transações do usuário', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const filters = {};
      const result = await service.getTransactionHistory(userId, filters);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalled();
    });

    it('deve filtrar por tipo de transação', async () => {
      const filteredTransactions = mockTransactions.filter((t) => t.type === TransactionType.TRANSFER);
      mockPrismaService.transaction.findMany.mockResolvedValue(filteredTransactions);

      const filters = { type: TransactionType.TRANSFER };
      const result = await service.getTransactionHistory(userId, filters);

      expect(result).toHaveLength(2);
    });

    it('deve filtrar por status', async () => {
      const filteredTransactions = mockTransactions.filter((t) => t.status === 'COMPLETED');
      mockPrismaService.transaction.findMany.mockResolvedValue(filteredTransactions);

      const filters = { status: 'COMPLETED' };
      const result = await service.getTransactionHistory(userId, filters);

      expect(result).toHaveLength(2);
    });
  });

  describe('getTransactionStats', () => {
    const userId = 'user-123';

    it('deve calcular estatísticas de transações', async () => {
      mockPrismaService.transaction.groupBy.mockResolvedValue([
        { status: 'COMPLETED', type: 'TRANSFER', _count: { id: 2 }, _sum: { amount: 150 } },
        { status: 'FAILED', type: 'TRANSFER', _count: { id: 1 }, _sum: { amount: 25 } },
      ]);

      const result = await service.getTransactionStats(userId);

      expect(result).toHaveProperty('totalTransactions');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('byType');
    });
  });
});

