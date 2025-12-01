import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentRequestsService } from './payment-requests.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestStatus, Currency, RequestCategory, AccountType } from '@prisma/client';

describe('PaymentRequestsService', () => {
  let service: PaymentRequestsService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    wallet: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRequestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<PaymentRequestsService>(PaymentRequestsService);

    jest.clearAllMocks();
  });

  describe('createPaymentRequest', () => {
    const requestData = {
      requesterId: 'user-requester',
      payerId: 'user-payer',
      amount: 100,
      currency: Currency.AOA,
      description: 'Test payment request',
      category: RequestCategory.PERSONAL,
    };

    const mockPayer = {
      id: 'user-payer',
      firstName: 'João',
      lastName: 'Silva',
    };

    const mockPaymentRequest = {
      id: 'request-123',
      ...requestData,
      status: RequestStatus.PENDING,
      createdAt: new Date(),
    };

    it('deve criar solicitação de pagamento com sucesso', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockPayer);
      mockPrismaService.paymentRequest.create.mockResolvedValue(mockPaymentRequest);
      mockNotificationsService.createNotification.mockResolvedValue({});

      const result = await service.createPaymentRequest(requestData);

      expect(result).toEqual(mockPaymentRequest);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: requestData.payerId },
      });
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('deve lançar erro se usuário destinatário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createPaymentRequest(requestData)).rejects.toThrow(NotFoundException);
      await expect(service.createPaymentRequest(requestData)).rejects.toThrow(
        'Usuário destinatário não encontrado',
      );
    });
  });

  describe('approvePaymentRequest', () => {
    const requestId = 'request-123';
    const userId = 'user-payer';
    const mockPaymentRequest = {
      id: requestId,
      requesterId: 'user-requester',
      payerId: userId,
      amount: 100,
      currency: Currency.AOA,
      status: RequestStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000), // 1 dia no futuro
    };

    const mockWallet = {
      id: 'wallet-123',
      userId,
      balances: { AOA: 500, USD: 0, EUR: 0 },
    };

    it('deve aprovar solicitação de pagamento com sucesso', async () => {
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(mockPaymentRequest);
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      mockPrismaService.paymentRequest.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: RequestStatus.PAID,
        paidAt: new Date(),
      });

      const result = await service.approvePaymentRequest(requestId, userId);

      expect(result.status).toBe(RequestStatus.PAID);
      expect(mockPrismaService.paymentRequest.update).toHaveBeenCalled();
    });

    it('deve lançar erro se solicitação não existir', async () => {
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(null);

      await expect(service.approvePaymentRequest(requestId, userId)).rejects.toThrow(NotFoundException);
    });

    it('deve lançar erro se solicitação já estiver paga (não encontrada por status PENDING)', async () => {
      // Quando o status é PAID, o findFirst retorna null porque busca por status PENDING
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(null);

      await expect(service.approvePaymentRequest(requestId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectPaymentRequest', () => {
    const requestId = 'request-123';
    const userId = 'user-payer';
    const mockPaymentRequest = {
      id: requestId,
      payerId: userId,
      status: RequestStatus.PENDING,
    };

    it('deve rejeitar solicitação com sucesso', async () => {
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(mockPaymentRequest);
      mockPrismaService.paymentRequest.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: RequestStatus.CANCELLED,
      });

      const result = await service.rejectPaymentRequest(requestId, userId);

      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(mockPrismaService.paymentRequest.update).toHaveBeenCalled();
    });

    it('deve lançar erro se solicitação não existir', async () => {
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(null);

      await expect(service.rejectPaymentRequest(requestId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelPaymentRequest', () => {
    const requestId = 'request-123';
    const userId = 'user-requester';
    const mockPaymentRequest = {
      id: requestId,
      requesterId: userId,
      status: RequestStatus.PENDING,
    };

    it('deve cancelar solicitação com sucesso', async () => {
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(mockPaymentRequest);
      mockPrismaService.paymentRequest.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: RequestStatus.CANCELLED,
      });

      const result = await service.cancelPaymentRequest(requestId, userId);

      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('deve lançar erro se solicitação já estiver paga', async () => {
      // O cancelPaymentRequest busca por requesterId e status PENDING
      // Se já estiver paga, não será encontrada
      mockPrismaService.paymentRequest.findFirst.mockResolvedValue(null);

      await expect(service.cancelPaymentRequest(requestId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMerchantStats', () => {
    const userId = 'user-merchant';
    const mockMerchantWallet = {
      id: 'wallet-merchant',
      userId,
      accountType: AccountType.MERCHANT,
    };

    it('deve retornar estatísticas do merchant', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockMerchantWallet);
      // getPaymentRequestStats faz várias queries
      mockPrismaService.paymentRequest.count
        .mockResolvedValueOnce(3) // totalSent
        .mockResolvedValueOnce(2) // totalReceived
        .mockResolvedValueOnce(1) // pendingSent
        .mockResolvedValueOnce(1) // pendingReceived
        .mockResolvedValueOnce(0) // approvedSent
        .mockResolvedValueOnce(0) // approvedReceived
        .mockResolvedValueOnce(0) // rejectedSent
        .mockResolvedValueOnce(0); // rejectedReceived
      mockPrismaService.paymentRequest.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 300 } }) // totalAmountSent
        .mockResolvedValueOnce({ _sum: { amount: 300 } }); // totalAmountReceived

      const result = await service.getMerchantStats(userId);

      expect(result).toHaveProperty('totalSent');
      expect(result).toHaveProperty('totalReceived');
      expect(result).toHaveProperty('merchantWalletId');
      expect(result).toHaveProperty('storeName');
    });

    it('deve lançar erro se usuário não tiver carteira MERCHANT', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.getMerchantStats(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserPaymentRequests', () => {
    const userId = 'user-123';
    const mockRequests = [
      {
        id: 'request-1',
        requesterId: userId,
        amount: 100,
        status: RequestStatus.PENDING,
      },
      {
        id: 'request-2',
        requesterId: userId,
        amount: 200,
        status: RequestStatus.PAID,
      },
    ];

    it('deve retornar lista de solicitações do usuário', async () => {
      mockPrismaService.paymentRequest.findMany.mockResolvedValue(mockRequests);
      mockPrismaService.paymentRequest.count.mockResolvedValue(2);

      const result = await service.getUserPaymentRequests(userId, 1, 20);

      expect(result).toHaveProperty('paymentRequests');
      expect(result).toHaveProperty('pagination');
      expect(result.paymentRequests).toEqual(mockRequests);
      expect(result.pagination.total).toBe(2);
    });

    it('deve aplicar paginação corretamente', async () => {
      mockPrismaService.paymentRequest.findMany.mockResolvedValue([mockRequests[0]]);
      mockPrismaService.paymentRequest.count.mockResolvedValue(2);

      const result = await service.getUserPaymentRequests(userId, 1, 1);

      expect(result.paymentRequests).toHaveLength(1);
      expect(mockPrismaService.paymentRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 1,
        }),
      );
    });
  });
});

