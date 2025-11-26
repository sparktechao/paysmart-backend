import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  TransactionResponseDto,
  TransactionFilterDto,
} from './dto/transactions.dto';
import { TransactionType, TransactionStatus, Currency } from '../common/enums/transaction.enum';
import { Request } from 'express';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;

  const mockUserId = 'user-123';
  const mockTransactionId = 'transaction-123';
  const mockWalletId = 'wallet-123';

  const mockRequest = {
    user: { id: mockUserId },
  } as unknown as Request;

  const mockTransaction: TransactionResponseDto = {
    id: mockTransactionId,
    fromWalletId: mockWalletId,
    toWalletId: 'wallet-456',
    amount: 5000,
    currency: Currency.AOA,
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    description: 'Test transaction',
    reference: 'TXN123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
    getTransactionHistory: jest.fn(),
    getTransactionStats: jest.fn(),
    confirmSmartContractCondition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTransaction', () => {
    const createTransactionDto: CreateTransactionDto = {
      fromWalletId: mockWalletId,
      toWalletId: 'wallet-456',
      amount: 5000,
      currency: Currency.AOA,
      type: TransactionType.TRANSFER,
      description: 'Test transaction',
      pin: '1234',
    };

    it('should create a transfer transaction with wallet ID', async () => {
      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);

      const result = await controller.createTransaction(
        mockRequest,
        createTransactionDto
      );

      expect(result).toEqual(mockTransaction);
      expect(service.createTransaction).toHaveBeenCalledWith({
        ...createTransactionDto,
      });
      expect(service.createTransaction).toHaveBeenCalledTimes(1);
    });

    it('should create a transfer transaction with phone number', async () => {
      const createWithPhoneDto: CreateTransactionDto = {
        fromWalletId: mockWalletId,
        toPhone: '+244123456789',
        amount: 5000,
        currency: Currency.AOA,
        type: TransactionType.TRANSFER,
        description: 'Transfer to phone',
        pin: '1234',
      };

      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);

      const result = await controller.createTransaction(
        mockRequest,
        createWithPhoneDto
      );

      expect(result).toEqual(mockTransaction);
      expect(service.createTransaction).toHaveBeenCalledWith({
        ...createWithPhoneDto,
      });
    });

    it('should create a deposit transaction', async () => {
      const depositDto: CreateTransactionDto = {
        toWalletId: mockWalletId,
        amount: 10000,
        currency: Currency.AOA,
        type: TransactionType.DEPOSIT,
        description: 'Deposit',
        pin: '1234',
      };

      const depositTransaction = {
        ...mockTransaction,
        type: TransactionType.DEPOSIT,
        amount: 10000,
      };
      mockTransactionsService.createTransaction.mockResolvedValue(depositTransaction);

      const result = await controller.createTransaction(mockRequest, depositDto);

      expect(result).toEqual(depositTransaction);
      expect(service.createTransaction).toHaveBeenCalledWith({
        ...depositDto,
      });
    });

    it('should create a withdrawal transaction', async () => {
      const withdrawalDto: CreateTransactionDto = {
        fromWalletId: mockWalletId,
        amount: 3000,
        currency: Currency.AOA,
        type: TransactionType.WITHDRAWAL,
        description: 'Withdrawal',
        pin: '1234',
      };

      const withdrawalTransaction = {
        ...mockTransaction,
        type: TransactionType.WITHDRAWAL,
        amount: 3000,
      };
      mockTransactionsService.createTransaction.mockResolvedValue(
        withdrawalTransaction
      );

      const result = await controller.createTransaction(mockRequest, withdrawalDto);

      expect(result).toEqual(withdrawalTransaction);
    });

    it('should throw error for insufficient balance', async () => {
      mockTransactionsService.createTransaction.mockRejectedValue(
        new Error('Insufficient balance')
      );

      await expect(
        controller.createTransaction(mockRequest, createTransactionDto)
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw error for invalid wallet', async () => {
      mockTransactionsService.createTransaction.mockRejectedValue(
        new Error('Wallet not found')
      );

      await expect(
        controller.createTransaction(mockRequest, createTransactionDto)
      ).rejects.toThrow('Wallet not found');
    });

    it('should throw error for invalid amount', async () => {
      const invalidDto: CreateTransactionDto = {
        ...createTransactionDto,
        amount: -100,
      };

      mockTransactionsService.createTransaction.mockRejectedValue(
        new Error('Invalid amount')
      );

      await expect(
        controller.createTransaction(mockRequest, invalidDto)
      ).rejects.toThrow();
    });
  });

  describe('getTransactionHistory', () => {
    const mockTransactions = [mockTransaction];

    it('should return transaction history without filters', async () => {
      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, {});

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(mockUserId, {});
      expect(service.getTransactionHistory).toHaveBeenCalledTimes(1);
    });

    it('should return filtered transactions by type', async () => {
      const filters: TransactionFilterDto = {
        type: TransactionType.TRANSFER,
      };

      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, filters);

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        filters
      );
    });

    it('should return filtered transactions by status', async () => {
      const filters: TransactionFilterDto = {
        status: TransactionStatus.COMPLETED,
      };

      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, filters);

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        filters
      );
    });

    it('should return filtered transactions by date range', async () => {
      const filters: TransactionFilterDto = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, filters);

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        filters
      );
    });

    it('should return paginated transactions', async () => {
      const filters: TransactionFilterDto = {
        limit: 10,
        offset: 0,
      };

      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, filters);

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        filters
      );
    });

    it('should return empty array when no transactions found', async () => {
      mockTransactionsService.getTransactionHistory.mockResolvedValue([]);

      const result = await controller.getTransactionHistory(mockRequest, {});

      expect(result).toEqual([]);
    });

    it('should handle multiple filters combined', async () => {
      const filters: TransactionFilterDto = {
        type: TransactionType.TRANSFER,
        status: TransactionStatus.COMPLETED,
        currency: Currency.AOA,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        limit: 20,
        offset: 0,
      };

      mockTransactionsService.getTransactionHistory.mockResolvedValue(
        mockTransactions
      );

      const result = await controller.getTransactionHistory(mockRequest, filters);

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        filters
      );
    });
  });

  describe('getTransactionStats', () => {
    const mockStats = {
      totalTransactions: 100,
      totalSent: 50000,
      totalReceived: 75000,
      totalDeposits: 100000,
      totalWithdrawals: 25000,
      balance: 50000,
      byType: {
        TRANSFER: 50,
        DEPOSIT: 30,
        WITHDRAWAL: 20,
      },
      byStatus: {
        COMPLETED: 90,
        PENDING: 8,
        FAILED: 2,
      },
      thisMonth: {
        transactions: 20,
        sent: 10000,
        received: 15000,
      },
    };

    it('should return transaction statistics', async () => {
      mockTransactionsService.getTransactionStats.mockResolvedValue(mockStats);

      const result = await controller.getTransactionStats(mockRequest);

      expect(result).toEqual(mockStats);
      expect(service.getTransactionStats).toHaveBeenCalledWith(mockUserId);
      expect(service.getTransactionStats).toHaveBeenCalledTimes(1);
    });

    it('should return stats for user with no transactions', async () => {
      const emptyStats = {
        totalTransactions: 0,
        totalSent: 0,
        totalReceived: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        balance: 0,
      };
      mockTransactionsService.getTransactionStats.mockResolvedValue(emptyStats);

      const result = await controller.getTransactionStats(mockRequest);

      expect(result).toEqual(emptyStats);
    });
  });

  describe('confirmSmartContractCondition', () => {
    const smartContractTransaction = {
      ...mockTransaction,
      type: TransactionType.SMART_CONTRACT,
      status: TransactionStatus.PENDING,
    };

    it('should confirm smart contract condition successfully', async () => {
      const confirmedTransaction = {
        ...smartContractTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockTransactionsService.confirmSmartContractCondition.mockResolvedValue(
        confirmedTransaction
      );

      const result = await controller.confirmSmartContractCondition(
        mockRequest,
        mockTransactionId
      );

      expect(result).toEqual(confirmedTransaction);
      expect(service.confirmSmartContractCondition).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId
      );
      expect(service.confirmSmartContractCondition).toHaveBeenCalledTimes(1);
    });

    it('should throw error when transaction not found', async () => {
      mockTransactionsService.confirmSmartContractCondition.mockRejectedValue(
        new Error('Transaction not found')
      );

      await expect(
        controller.confirmSmartContractCondition(mockRequest, 'non-existent-id')
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error when transaction is not a smart contract', async () => {
      mockTransactionsService.confirmSmartContractCondition.mockRejectedValue(
        new Error('Transaction is not a smart contract')
      );

      await expect(
        controller.confirmSmartContractCondition(mockRequest, mockTransactionId)
      ).rejects.toThrow('Transaction is not a smart contract');
    });

    it('should throw error when user is not authorized', async () => {
      mockTransactionsService.confirmSmartContractCondition.mockRejectedValue(
        new Error('Unauthorized')
      );

      await expect(
        controller.confirmSmartContractCondition(mockRequest, mockTransactionId)
      ).rejects.toThrow('Unauthorized');
    });
  });
});
