import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallets.dto';
import { AccountType } from '../common/enums/account-type.enum';

describe('WalletsService', () => {
  let service: WalletsService;

  const mockPrismaService = {
    wallet: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
  });

  describe('getUserWallets', () => {
    const userId = 'user-123';
    const mockWallets = [
      {
        id: 'wallet-1',
        userId,
        walletNumber: 'PS1234567890',
        isDefault: true,
      },
      {
        id: 'wallet-2',
        userId,
        walletNumber: 'PS0987654321',
        isDefault: false,
      },
    ];

    it('deve retornar todas as carteiras do usuário ordenadas por padrão', async () => {
      mockPrismaService.wallet.findMany.mockResolvedValue(mockWallets);

      const result = await service.getUserWallets(userId);

      expect(result).toEqual(mockWallets);
      expect(mockPrismaService.wallet.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { isDefault: 'desc' },
      });
    });

    it('deve retornar array vazio se usuário não tiver carteiras', async () => {
      mockPrismaService.wallet.findMany.mockResolvedValue([]);

      const result = await service.getUserWallets(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getWalletById', () => {
    const walletId = 'wallet-123';
    const userId = 'user-123';
    const mockWallet = {
      id: walletId,
      userId,
      walletNumber: 'PS1234567890',
      balances: { AOA: 1000, USD: 50, EUR: 25 },
    };

    it('deve retornar carteira se existir e pertencer ao usuário', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletById(walletId, userId);

      expect(result).toEqual(mockWallet);
      expect(mockPrismaService.wallet.findFirst).toHaveBeenCalledWith({
        where: { id: walletId, userId },
      });
    });

    it('deve lançar NotFoundException se carteira não existir', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.getWalletById(walletId, userId)).rejects.toThrow(NotFoundException);
      await expect(service.getWalletById(walletId, userId)).rejects.toThrow('Carteira não encontrada');
    });

    it('deve lançar NotFoundException se carteira pertencer a outro usuário', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.getWalletById(walletId, 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWalletBalance', () => {
    const walletId = 'wallet-123';
    const userId = 'user-123';
    const mockWallet = {
      id: walletId,
      userId,
      balances: { AOA: 1000, USD: 50, EUR: 25 },
    };

    it('deve retornar saldo da carteira', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletBalance(walletId, userId);

      expect(result).toEqual(mockWallet.balances);
    });
  });

  describe('createWallet', () => {
    const userId = 'user-123';
    const baseCreateDto: CreateWalletDto = {
      accountType: AccountType.PERSONAL,
      pin: '1234',
    };

    it('deve criar carteira PERSONAL com sucesso', async () => {
      mockPrismaService.wallet.findMany.mockResolvedValue([]);
      const mockCreatedWallet = {
        id: 'wallet-123',
        userId,
        walletNumber: 'PS1234567890',
        accountType: AccountType.PERSONAL,
        balances: { AOA: 0, USD: 0, EUR: 0 },
        isDefault: true,
      };
      mockPrismaService.wallet.create.mockResolvedValue(mockCreatedWallet);

      const result = await service.createWallet(userId, baseCreateDto);

      expect(result).toEqual(mockCreatedWallet);
      expect(mockPrismaService.wallet.create).toHaveBeenCalled();
      expect(result.accountType).toBe(AccountType.PERSONAL);
    });

    it('deve criar carteira BUSINESS com businessInfo', async () => {
      const businessDto: CreateWalletDto = {
        accountType: AccountType.BUSINESS,
        pin: '1234',
        businessInfo: {
          companyName: 'Minha Empresa',
          taxId: '123456789',
        },
      };
      mockPrismaService.wallet.findMany.mockResolvedValue([]);
      const mockCreatedWallet = {
        id: 'wallet-123',
        userId,
        accountType: AccountType.BUSINESS,
        businessInfo: businessDto.businessInfo,
      };
      mockPrismaService.wallet.create.mockResolvedValue(mockCreatedWallet);

      const result = await service.createWallet(userId, businessDto);

      expect(result.accountType).toBe(AccountType.BUSINESS);
      expect(result.businessInfo).toBeDefined();
    });

    it('deve criar carteira MERCHANT com merchantInfo', async () => {
      const merchantDto: CreateWalletDto = {
        accountType: AccountType.MERCHANT,
        pin: '1234',
        merchantInfo: {
          storeName: 'Minha Loja',
          category: 'Retail',
        },
      };
      mockPrismaService.wallet.findMany.mockResolvedValue([]);
      const mockCreatedWallet = {
        id: 'wallet-123',
        userId,
        accountType: AccountType.MERCHANT,
        merchantInfo: merchantDto.merchantInfo,
      };
      mockPrismaService.wallet.create.mockResolvedValue(mockCreatedWallet);

      const result = await service.createWallet(userId, merchantDto);

      expect(result.accountType).toBe(AccountType.MERCHANT);
      expect(result.merchantInfo).toBeDefined();
    });

    it('deve lançar erro se BUSINESS não tiver businessInfo', async () => {
      const businessDto: CreateWalletDto = {
        accountType: AccountType.BUSINESS,
        pin: '1234',
      };

      await expect(service.createWallet(userId, businessDto)).rejects.toThrow(BadRequestException);
      await expect(service.createWallet(userId, businessDto)).rejects.toThrow(
        'Informações da empresa são obrigatórias para contas BUSINESS',
      );
    });

    it('deve lançar erro se MERCHANT não tiver merchantInfo', async () => {
      const merchantDto: CreateWalletDto = {
        accountType: AccountType.MERCHANT,
        pin: '1234',
      };

      await expect(service.createWallet(userId, merchantDto)).rejects.toThrow(BadRequestException);
      await expect(service.createWallet(userId, merchantDto)).rejects.toThrow(
        'Informações do merchant são obrigatórias para contas MERCHANT',
      );
    });

    it('deve tornar carteira padrão se for a primeira', async () => {
      mockPrismaService.wallet.findMany.mockResolvedValue([]);
      const mockCreatedWallet = {
        id: 'wallet-123',
        userId,
        isDefault: true,
      };
      mockPrismaService.wallet.create.mockResolvedValue(mockCreatedWallet);

      const result = await service.createWallet(userId, baseCreateDto);

      expect(result.isDefault).toBe(true);
    });

    it('deve remover padrão de outras carteiras se isDefault for true', async () => {
      mockPrismaService.wallet.findMany.mockResolvedValue([{ id: 'existing-wallet', isDefault: true }]);
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });
      const mockCreatedWallet = {
        id: 'wallet-123',
        userId,
        isDefault: true,
      };
      mockPrismaService.wallet.create.mockResolvedValue(mockCreatedWallet);

      await service.createWallet(userId, { ...baseCreateDto, isDefault: true });

      expect(mockPrismaService.wallet.updateMany).toHaveBeenCalled();
    });
  });

  describe('updateWallet', () => {
    const walletId = 'wallet-123';
    const userId = 'user-123';
    const mockWallet = {
      id: walletId,
      userId,
      isDefault: false,
      businessInfo: null,
      merchantInfo: null,
    };

    it('deve atualizar carteira com sucesso', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      const updatedWallet = { ...mockWallet, isDefault: true };
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const updateDto: UpdateWalletDto = { isDefault: true };
      const result = await service.updateWallet(walletId, userId, updateDto);

      expect(result).toEqual(updatedWallet);
      expect(mockPrismaService.wallet.update).toHaveBeenCalled();
    });

    it('deve atualizar businessInfo', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      const newBusinessInfo = {
        companyName: 'Nova Empresa',
        taxId: '987654321',
      };
      const updatedWallet = { ...mockWallet, businessInfo: newBusinessInfo };
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const updateDto: UpdateWalletDto = { businessInfo: newBusinessInfo as any };
      const result = await service.updateWallet(walletId, userId, updateDto);

      expect(result.businessInfo).toEqual(newBusinessInfo);
    });

    it('deve atualizar merchantInfo', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      const newMerchantInfo = {
        storeName: 'Nova Loja',
        category: 'Food',
      };
      const updatedWallet = { ...mockWallet, merchantInfo: newMerchantInfo };
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const updateDto: UpdateWalletDto = { merchantInfo: newMerchantInfo as any };
      const result = await service.updateWallet(walletId, userId, updateDto);

      expect(result.merchantInfo).toEqual(newMerchantInfo);
    });

    it('deve remover padrão de outras carteiras ao definir como padrão', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });
      const updatedWallet = { ...mockWallet, isDefault: true };
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const updateDto: UpdateWalletDto = { isDefault: true };
      await service.updateWallet(walletId, userId, updateDto);

      expect(mockPrismaService.wallet.updateMany).toHaveBeenCalled();
    });

    it('deve lançar erro se carteira não existir', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.updateWallet(walletId, userId, {})).rejects.toThrow(NotFoundException);
    });
  });
});

