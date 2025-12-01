import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePinDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    wallet: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      phone: '+244123456789',
      email: 'test@example.com',
      firstName: 'João',
      lastName: 'Silva',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      documentType: 'BI',
      documentNumber: '123456789LA123',
      documentExpiry: '2030-01-01',
      pin: '1234',
    };

    const mockUser = {
      id: 'user-123',
      phone: '+244123456789',
      firstName: 'João',
      lastName: 'Silva',
      userType: 'BASIC',
      status: 'PENDING',
      wallet: {
        id: 'wallet-123',
        walletNumber: 'PS1234567890',
      },
    };

    it('deve registrar um novo usuário com sucesso', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          wallet: {
            create: jest.fn().mockResolvedValue(mockUser.wallet),
          },
        });
      });
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockJwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.phone).toBe(registerDto.phone);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { phone: registerDto.phone },
      });
    });

    it('deve lançar erro se telefone já estiver registrado', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto)).rejects.toThrow('Telefone já registrado');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      phone: '+244123456789',
      pin: '1234',
    };

    let mockUser: any;

    beforeAll(async () => {
      mockUser = {
        id: 'user-123',
        phone: '+244123456789',
        firstName: 'João',
        lastName: 'Silva',
        userType: 'BASIC',
        status: 'ACTIVE',
        wallets: [
          {
            id: 'wallet-123',
            security: {
              pin: await bcrypt.hash('1234', 12),
            },
          },
        ],
      };
    });

    it('deve fazer login com sucesso', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockJwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.phone).toBe(loginDto.phone);
    });

    it('deve lançar erro se usuário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar erro se PIN estiver incorreto', async () => {
      const userWithWrongPin = {
        ...mockUser,
        wallets: [
          {
            id: 'wallet-123',
            security: {
              pin: await bcrypt.hash('wrong-pin', 12),
            },
          },
        ],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithWrongPin);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar erro se conta não estiver ativa', async () => {
      const inactiveUser = {
        ...mockUser,
        status: 'SUSPENDED',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Conta não está ativa');
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockUser = {
      id: 'user-123',
      phone: '+244123456789',
      firstName: 'João',
      lastName: 'Silva',
      userType: 'BASIC',
      status: 'ACTIVE',
    };

    it('deve renovar token com sucesso', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-123' });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockJwtService.signAsync.mockResolvedValueOnce('new-access-token').mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('deve lançar erro se token for inválido', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar erro se usuário não existir', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-123' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePin', () => {
    const userId = 'user-123';
    const changePinDto: ChangePinDto = {
      currentPin: '1234',
      newPin: '5678',
    };

    let mockWallet: any;

    beforeAll(async () => {
      mockWallet = {
        id: 'wallet-123',
        userId,
        security: {
          pin: await bcrypt.hash('1234', 12),
        },
      };
    });

    it('deve alterar PIN com sucesso', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(mockWallet);
      mockPrismaService.wallet.update.mockResolvedValue({ ...mockWallet, security: { pin: 'new-hashed-pin' } });

      const result = await service.changePin(userId, changePinDto);

      expect(result).toHaveProperty('message');
      expect(result.message).toBe('PIN alterado com sucesso');
      expect(mockPrismaService.wallet.update).toHaveBeenCalled();
    });

    it('deve lançar erro se carteira não existir', async () => {
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.changePin(userId, changePinDto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, changePinDto)).rejects.toThrow('Carteira não encontrada');
    });

    it('deve lançar erro se PIN atual estiver incorreto', async () => {
      const walletWithWrongPin = {
        ...mockWallet,
        security: {
          pin: await bcrypt.hash('wrong-pin', 12),
        },
      };
      mockPrismaService.wallet.findFirst.mockResolvedValue(walletWithWrongPin);

      await expect(service.changePin(userId, changePinDto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, changePinDto)).rejects.toThrow('PIN atual incorreto');
    });
  });

  describe('validateUser', () => {
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      phone: '+244123456789',
      firstName: 'João',
      lastName: 'Silva',
    };

    it('deve retornar usuário se existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser(userId);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('deve retornar null se usuário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(userId);

      expect(result).toBeNull();
    });
  });
});

