import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, UpdateWalletDto, WalletResponseDto } from './dto/wallets.dto';
import { AccountType } from '../common/enums/account-type.enum';
import { Request } from 'express';

describe('WalletsController', () => {
  let controller: WalletsController;
  let service: WalletsService;

  const mockUserId = 'user-123';
  const mockWalletId = 'wallet-123';

  const mockRequest = {
    user: { id: mockUserId },
  } as unknown as Request;

  const mockWallet: WalletResponseDto = {
    id: mockWalletId,
    userId: mockUserId,
    walletNumber: 'PS1234567890',
    accountType: AccountType.PERSONAL,
    balances: { AOA: 10000, USD: 0, EUR: 0 },
    limits: {},
    status: 'ACTIVE',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockWalletsService = {
    getUserWallets: jest.fn(),
    getWalletById: jest.fn(),
    getWalletBalance: jest.fn(),
    createWallet: jest.fn(),
    updateWallet: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        {
          provide: WalletsService,
          useValue: mockWalletsService,
        },
      ],
    }).compile();

    controller = module.get<WalletsController>(WalletsController);
    service = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserWallets', () => {
    it('should return all wallets for the authenticated user', async () => {
      const mockWallets = [mockWallet];
      mockWalletsService.getUserWallets.mockResolvedValue(mockWallets);

      const result = await controller.getUserWallets(mockRequest);

      expect(result).toEqual(mockWallets);
      expect(service.getUserWallets).toHaveBeenCalledWith(mockUserId);
      expect(service.getUserWallets).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no wallets', async () => {
      mockWalletsService.getUserWallets.mockResolvedValue([]);

      const result = await controller.getUserWallets(mockRequest);

      expect(result).toEqual([]);
      expect(service.getUserWallets).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getWalletById', () => {
    it('should return a wallet by id for the authenticated user', async () => {
      mockWalletsService.getWalletById.mockResolvedValue(mockWallet);

      const result = await controller.getWalletById(mockRequest, mockWalletId);

      expect(result).toEqual(mockWallet);
      expect(service.getWalletById).toHaveBeenCalledWith(mockWalletId, mockUserId);
      expect(service.getWalletById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      mockWalletsService.getWalletById.mockRejectedValue(
        new Error('Wallet not found')
      );

      await expect(
        controller.getWalletById(mockRequest, 'non-existent-id')
      ).rejects.toThrow();
      expect(service.getWalletById).toHaveBeenCalledWith('non-existent-id', mockUserId);
    });

    it('should throw error when trying to access another user wallet', async () => {
      mockWalletsService.getWalletById.mockRejectedValue(
        new Error('Unauthorized')
      );

      await expect(
        controller.getWalletById(mockRequest, mockWalletId)
      ).rejects.toThrow();
    });
  });

  describe('getWalletBalance', () => {
    it('should return wallet balance', async () => {
      const mockBalance = { balance: 10000, currency: 'AOA' };
      mockWalletsService.getWalletBalance.mockResolvedValue(mockBalance);

      const result = await controller.getWalletBalance(mockRequest, mockWalletId);

      expect(result).toEqual(mockBalance);
      expect(service.getWalletBalance).toHaveBeenCalledWith(mockWalletId, mockUserId);
      expect(service.getWalletBalance).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      mockWalletsService.getWalletBalance.mockRejectedValue(
        new Error('Wallet not found')
      );

      await expect(
        controller.getWalletBalance(mockRequest, 'non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('createWallet', () => {
    const createWalletDto: CreateWalletDto = {
      accountType: AccountType.PERSONAL,
      pin: '1234',
    };

    it('should create a new personal wallet', async () => {
      mockWalletsService.createWallet.mockResolvedValue(mockWallet);

      const result = await controller.createWallet(mockRequest, createWalletDto);

      expect(result).toEqual(mockWallet);
      expect(service.createWallet).toHaveBeenCalledWith(mockUserId, createWalletDto);
      expect(service.createWallet).toHaveBeenCalledTimes(1);
    });

    it('should create a business wallet with business info', async () => {
      const businessWalletDto: CreateWalletDto = {
        accountType: AccountType.BUSINESS,
        pin: '1234',
        businessInfo: {
          companyName: 'Test Business',
          taxId: '123456789',
        },
      };

      const businessWallet = { ...mockWallet, accountType: AccountType.BUSINESS };
      mockWalletsService.createWallet.mockResolvedValue(businessWallet);

      const result = await controller.createWallet(mockRequest, businessWalletDto);

      expect(result).toEqual(businessWallet);
      expect(service.createWallet).toHaveBeenCalledWith(mockUserId, businessWalletDto);
    });

    it('should create a merchant wallet', async () => {
      const merchantWalletDto: CreateWalletDto = {
        accountType: AccountType.MERCHANT,
        pin: '1234',
        merchantInfo: {
          storeName: 'Test Merchant',
          category: 'Retail',
        },
      };

      const merchantWallet = { ...mockWallet, accountType: AccountType.MERCHANT };
      mockWalletsService.createWallet.mockResolvedValue(merchantWallet);

      const result = await controller.createWallet(mockRequest, merchantWalletDto);

      expect(result).toEqual(merchantWallet);
      expect(service.createWallet).toHaveBeenCalledWith(mockUserId, merchantWalletDto);
    });

    it('should throw BadRequestException for invalid data', async () => {
      mockWalletsService.createWallet.mockRejectedValue(
        new Error('Invalid wallet data')
      );

      await expect(
        controller.createWallet(mockRequest, createWalletDto)
      ).rejects.toThrow();
    });
  });

  describe('updateWallet', () => {
    const updateWalletDto: UpdateWalletDto = {
      isDefault: true,
    };

    it('should update wallet successfully', async () => {
      const updatedWallet = { ...mockWallet, isDefault: true };
      mockWalletsService.updateWallet.mockResolvedValue(updatedWallet);

      const result = await controller.updateWallet(
        mockRequest,
        mockWalletId,
        updateWalletDto
      );

      expect(result).toEqual(updatedWallet);
      expect(service.updateWallet).toHaveBeenCalledWith(
        mockWalletId,
        mockUserId,
        updateWalletDto
      );
      expect(service.updateWallet).toHaveBeenCalledTimes(1);
    });

    it('should set wallet as default and unset others', async () => {
      const setDefaultDto: UpdateWalletDto = { isDefault: true };
      const updatedWallet = { ...mockWallet, isDefault: true };
      mockWalletsService.updateWallet.mockResolvedValue(updatedWallet);

      const result = await controller.updateWallet(
        mockRequest,
        mockWalletId,
        setDefaultDto
      );

      expect(result.isDefault).toBe(true);
      expect(service.updateWallet).toHaveBeenCalledWith(
        mockWalletId,
        mockUserId,
        setDefaultDto
      );
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      mockWalletsService.updateWallet.mockRejectedValue(
        new Error('Wallet not found')
      );

      await expect(
        controller.updateWallet(mockRequest, 'non-existent-id', updateWalletDto)
      ).rejects.toThrow();
    });

    it('should throw error when trying to update another user wallet', async () => {
      mockWalletsService.updateWallet.mockRejectedValue(
        new Error('Unauthorized')
      );

      await expect(
        controller.updateWallet(mockRequest, mockWalletId, updateWalletDto)
      ).rejects.toThrow();
    });
  });
});
