import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';
import {
  CreatePaymentRequestDto,
  PaymentRequestResponseDto,
} from './dto/payment-requests.dto';
import { Currency, RequestCategory, RequestStatus } from '@prisma/client';
import { Request } from 'express';

describe('PaymentRequestsController', () => {
  let controller: PaymentRequestsController;
  let service: PaymentRequestsService;

  const mockUserId = 'user-123';
  const mockPayerId = 'payer-456';
  const mockRequestId = 'request-123';

  const mockRequest = {
    user: { id: mockUserId },
  } as unknown as Request;

  const mockPaymentRequest: PaymentRequestResponseDto = {
    id: mockRequestId,
    requesterId: mockUserId,
    payerId: mockPayerId,
    amount: 5000,
    status: RequestStatus.PENDING,
    description: 'Test payment request',
    category: RequestCategory.PERSONAL,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPaymentRequestsService = {
    createPaymentRequest: jest.fn(),
    getUserPaymentRequests: jest.fn(),
    getReceivedPaymentRequests: jest.fn(),
    getPaymentRequestById: jest.fn(),
    approvePaymentRequest: jest.fn(),
    rejectPaymentRequest: jest.fn(),
    cancelPaymentRequest: jest.fn(),
    getPendingPaymentRequests: jest.fn(),
    getPaymentRequestStats: jest.fn(),
    getMerchantStats: jest.fn(),
    getMerchantPaymentLinks: jest.fn(),
    generatePaymentLink: jest.fn(),
    generatePaymentQRCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentRequestsController],
      providers: [
        {
          provide: PaymentRequestsService,
          useValue: mockPaymentRequestsService,
        },
      ],
    }).compile();

    controller = module.get<PaymentRequestsController>(
      PaymentRequestsController
    );
    service = module.get<PaymentRequestsService>(PaymentRequestsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPaymentRequest', () => {
    const createDto: CreatePaymentRequestDto = {
      payerId: mockPayerId,
      amount: 5000,
      description: 'Test payment request',
      category: RequestCategory.PERSONAL,
    };

    it('should create a payment request with default currency and category', async () => {
      mockPaymentRequestsService.createPaymentRequest.mockResolvedValue(
        mockPaymentRequest
      );

      const result = await controller.createPaymentRequest(mockRequest, createDto);

      expect(result).toEqual(mockPaymentRequest);
      expect(service.createPaymentRequest).toHaveBeenCalledWith({
        requesterId: mockUserId,
        payerId: createDto.payerId,
        amount: createDto.amount,
        currency: Currency.AOA,
        description: createDto.description,
        category: RequestCategory.PERSONAL,
        expiresAt: undefined,
        metadata: undefined,
      });
      expect(service.createPaymentRequest).toHaveBeenCalledTimes(1);
    });

    it('should create a payment request with expiration date', async () => {
      const expiresAt = '2024-12-31T23:59:59Z';
      const dtoWithExpiration = { ...createDto, expiresAt };

      mockPaymentRequestsService.createPaymentRequest.mockResolvedValue({
        ...mockPaymentRequest,
        expiresAt: new Date(expiresAt),
      });

      await controller.createPaymentRequest(
        mockRequest,
        dtoWithExpiration
      );

      expect(service.createPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(expiresAt),
        })
      );
    });

    it('should create a payment request with metadata', async () => {
      const metadata = { orderId: 'ORD-123', productName: 'Product A' };
      const dtoWithMetadata = { ...createDto, metadata };

      mockPaymentRequestsService.createPaymentRequest.mockResolvedValue({
        ...mockPaymentRequest,
        metadata,
      });

      await controller.createPaymentRequest(
        mockRequest,
        dtoWithMetadata
      );

      expect(service.createPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should throw error for invalid amount', async () => {
      const invalidDto = { ...createDto, amount: -100 };
      mockPaymentRequestsService.createPaymentRequest.mockRejectedValue(
        new Error('Invalid amount')
      );

      await expect(
        controller.createPaymentRequest(mockRequest, invalidDto)
      ).rejects.toThrow();
    });
  });

  describe('getUserPaymentRequests', () => {
    it('should return user payment requests with default pagination', async () => {
      const mockRequests = [mockPaymentRequest];
      mockPaymentRequestsService.getUserPaymentRequests.mockResolvedValue(
        mockRequests
      );

      const result = await controller.getUserPaymentRequests(mockRequest);

      expect(result).toEqual(mockRequests);
      expect(service.getUserPaymentRequests).toHaveBeenCalledWith(
        mockUserId,
        1,
        10
      );
    });

    it('should return user payment requests with custom pagination', async () => {
      const mockRequests = [mockPaymentRequest];
      mockPaymentRequestsService.getUserPaymentRequests.mockResolvedValue(
        mockRequests
      );

      const result = await controller.getUserPaymentRequests(
        mockRequest,
        2,
        20
      );

      expect(result).toEqual(mockRequests);
      expect(service.getUserPaymentRequests).toHaveBeenCalledWith(
        mockUserId,
        2,
        20
      );
    });
  });

  describe('getReceivedPaymentRequests', () => {
    it('should return received payment requests', async () => {
      const mockRequests = [mockPaymentRequest];
      mockPaymentRequestsService.getReceivedPaymentRequests.mockResolvedValue(
        mockRequests
      );

      const result = await controller.getReceivedPaymentRequests(mockRequest);

      expect(result).toEqual(mockRequests);
      expect(service.getReceivedPaymentRequests).toHaveBeenCalledWith(
        mockUserId,
        1,
        10
      );
    });

    it('should return received payment requests with pagination', async () => {
      const mockRequests = [mockPaymentRequest];
      mockPaymentRequestsService.getReceivedPaymentRequests.mockResolvedValue(
        mockRequests
      );

      await controller.getReceivedPaymentRequests(
        mockRequest,
        3,
        15
      );

      expect(service.getReceivedPaymentRequests).toHaveBeenCalledWith(
        mockUserId,
        3,
        15
      );
    });
  });

  describe('getPaymentRequestById', () => {
    it('should return a payment request by id', async () => {
      mockPaymentRequestsService.getPaymentRequestById.mockResolvedValue(
        mockPaymentRequest
      );

      const result = await controller.getPaymentRequestById(
        mockRequest,
        mockRequestId
      );

      expect(result).toEqual(mockPaymentRequest);
      expect(service.getPaymentRequestById).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId
      );
    });

    it('should throw error when payment request not found', async () => {
      mockPaymentRequestsService.getPaymentRequestById.mockRejectedValue(
        new Error('Payment request not found')
      );

      await expect(
        controller.getPaymentRequestById(mockRequest, 'non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('approvePaymentRequest', () => {
    it('should approve a payment request', async () => {
      const approvedRequest = {
        ...mockPaymentRequest,
        status: RequestStatus.PAID,
      };
      mockPaymentRequestsService.approvePaymentRequest.mockResolvedValue(
        approvedRequest
      );

      const result = await controller.approvePaymentRequest(
        mockRequest,
        mockRequestId
      );

      expect(result).toEqual(approvedRequest);
      expect(service.approvePaymentRequest).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId
      );
    });

    it('should throw error when request cannot be approved', async () => {
      mockPaymentRequestsService.approvePaymentRequest.mockRejectedValue(
        new Error('Request cannot be approved')
      );

      await expect(
        controller.approvePaymentRequest(mockRequest, mockRequestId)
      ).rejects.toThrow();
    });
  });

  describe('rejectPaymentRequest', () => {
    it('should reject a payment request', async () => {
      const rejectedRequest = {
        ...mockPaymentRequest,
        status: RequestStatus.CANCELLED,
      };
      mockPaymentRequestsService.rejectPaymentRequest.mockResolvedValue(
        rejectedRequest
      );

      const result = await controller.rejectPaymentRequest(
        mockRequest,
        mockRequestId
      );

      expect(result).toEqual(rejectedRequest);
      expect(service.rejectPaymentRequest).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId
      );
    });

    it('should throw error when request cannot be rejected', async () => {
      mockPaymentRequestsService.rejectPaymentRequest.mockRejectedValue(
        new Error('Request cannot be rejected')
      );

      await expect(
        controller.rejectPaymentRequest(mockRequest, mockRequestId)
      ).rejects.toThrow();
    });
  });

  describe('cancelPaymentRequest', () => {
    it('should cancel a payment request', async () => {
      const cancelledRequest = {
        ...mockPaymentRequest,
        status: RequestStatus.CANCELLED,
      };
      mockPaymentRequestsService.cancelPaymentRequest.mockResolvedValue(
        cancelledRequest
      );

      const result = await controller.cancelPaymentRequest(
        mockRequest,
        mockRequestId
      );

      expect(result).toEqual(cancelledRequest);
      expect(service.cancelPaymentRequest).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId
      );
    });

    it('should throw error when request cannot be cancelled', async () => {
      mockPaymentRequestsService.cancelPaymentRequest.mockRejectedValue(
        new Error('Request cannot be cancelled')
      );

      await expect(
        controller.cancelPaymentRequest(mockRequest, mockRequestId)
      ).rejects.toThrow();
    });
  });

  describe('getPendingPaymentRequests', () => {
    it('should return pending payment requests', async () => {
      const mockRequests = [mockPaymentRequest];
      mockPaymentRequestsService.getPendingPaymentRequests.mockResolvedValue(
        mockRequests
      );

      const result = await controller.getPendingPaymentRequests(mockRequest);

      expect(result).toEqual(mockRequests);
      expect(service.getPendingPaymentRequests).toHaveBeenCalledWith(
        mockUserId,
        1,
        20
      );
    });
  });

  describe('getPaymentRequestStats', () => {
    const mockStats = {
      totalRequests: 50,
      pending: 10,
      approved: 35,
      rejected: 3,
      cancelled: 2,
      totalAmount: 250000,
    };

    it('should return payment request statistics', async () => {
      mockPaymentRequestsService.getPaymentRequestStats.mockResolvedValue(
        mockStats
      );

      const result = await controller.getPaymentRequestStats(mockRequest);

      expect(result).toEqual(mockStats);
      expect(service.getPaymentRequestStats).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getMerchantStats', () => {
    const mockMerchantStats = {
      totalRevenue: 1000000,
      totalTransactions: 500,
      averageTransactionValue: 2000,
      topProducts: [],
      monthlyRevenue: 150000,
    };

    it('should return merchant statistics', async () => {
      mockPaymentRequestsService.getMerchantStats.mockResolvedValue(
        mockMerchantStats
      );

      const result = await controller.getMerchantStats(mockRequest);

      expect(result).toEqual(mockMerchantStats);
      expect(service.getMerchantStats).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw error when user is not a merchant', async () => {
      mockPaymentRequestsService.getMerchantStats.mockRejectedValue(
        new Error('User does not have a MERCHANT wallet')
      );

      await expect(controller.getMerchantStats(mockRequest)).rejects.toThrow();
    });
  });

  describe('getMerchantPaymentLinks', () => {
    const mockPaymentLinks = [
      {
        id: 'link-123',
        url: 'https://pay.paysmart.ao/link-123',
        amount: 10000,
        description: 'Payment link',
      },
    ];

    it('should return merchant payment links', async () => {
      mockPaymentRequestsService.getMerchantPaymentLinks.mockResolvedValue(
        mockPaymentLinks
      );

      const result = await controller.getMerchantPaymentLinks(mockRequest);

      expect(result).toEqual(mockPaymentLinks);
      expect(service.getMerchantPaymentLinks).toHaveBeenCalledWith(
        mockUserId,
        1,
        20
      );
    });

    it('should return merchant payment links with pagination', async () => {
      mockPaymentRequestsService.getMerchantPaymentLinks.mockResolvedValue(
        mockPaymentLinks
      );

      await controller.getMerchantPaymentLinks(
        mockRequest,
        2,
        50
      );

      expect(service.getMerchantPaymentLinks).toHaveBeenCalledWith(
        mockUserId,
        2,
        50
      );
    });
  });

  describe('generatePaymentLink', () => {
    const linkData = {
      amount: 10000,
      currency: Currency.AOA,
      description: 'Product purchase',
      expiresInDays: 7,
    };

    const mockGeneratedLink = {
      id: 'link-123',
      url: 'https://pay.paysmart.ao/link-123',
      ...linkData,
    };

    it('should generate a payment link', async () => {
      mockPaymentRequestsService.generatePaymentLink.mockResolvedValue(
        mockGeneratedLink
      );

      const result = await controller.generatePaymentLink(mockRequest, linkData);

      expect(result).toEqual(mockGeneratedLink);
      expect(service.generatePaymentLink).toHaveBeenCalledWith(
        mockUserId,
        linkData.amount,
        linkData.currency,
        linkData.description,
        linkData.expiresInDays
      );
    });

    it('should generate a payment link without expiration', async () => {
      const linkDataNoExpiry = { ...linkData };
      delete linkDataNoExpiry.expiresInDays;

      mockPaymentRequestsService.generatePaymentLink.mockResolvedValue(
        mockGeneratedLink
      );

      await controller.generatePaymentLink(
        mockRequest,
        linkDataNoExpiry
      );

      expect(service.generatePaymentLink).toHaveBeenCalledWith(
        mockUserId,
        linkDataNoExpiry.amount,
        linkDataNoExpiry.currency,
        linkDataNoExpiry.description,
        undefined
      );
    });

    it('should throw error when user is not a merchant', async () => {
      mockPaymentRequestsService.generatePaymentLink.mockRejectedValue(
        new Error('User does not have a MERCHANT wallet')
      );

      await expect(
        controller.generatePaymentLink(mockRequest, linkData)
      ).rejects.toThrow();
    });
  });

  describe('generatePaymentQRCode', () => {
    const mockQRCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...';

    it('should generate a QR code for payment request', async () => {
      mockPaymentRequestsService.generatePaymentQRCode.mockResolvedValue(
        mockQRCode
      );

      const result = await controller.generatePaymentQRCode(
        mockRequest,
        mockRequestId
      );

      expect(result).toEqual({ qrCode: mockQRCode });
      expect(service.generatePaymentQRCode).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId
      );
    });

    it('should throw error when user is not a merchant', async () => {
      mockPaymentRequestsService.generatePaymentQRCode.mockRejectedValue(
        new Error('User does not have a MERCHANT wallet')
      );

      await expect(
        controller.generatePaymentQRCode(mockRequest, mockRequestId)
      ).rejects.toThrow();
    });

    it('should throw error when QR code is not enabled', async () => {
      mockPaymentRequestsService.generatePaymentQRCode.mockRejectedValue(
        new Error('QR Code is not enabled')
      );

      await expect(
        controller.generatePaymentQRCode(mockRequest, mockRequestId)
      ).rejects.toThrow();
    });
  });
});
