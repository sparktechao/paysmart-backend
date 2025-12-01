import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePinDto } from './dto/auth.dto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    changePin: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      phone: '+244123456789',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

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

    const mockResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-123',
        phone: registerDto.phone,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        userType: 'BASIC',
        status: 'PENDING',
      },
    };

    it('deve registrar usuário com sucesso', async () => {
      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('deve lançar erro se telefone já estiver registrado', async () => {
      mockAuthService.register.mockRejectedValue(
        new BadRequestException('Telefone já registrado'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      phone: '+244123456789',
      pin: '1234',
    };

    const mockResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-123',
        phone: loginDto.phone,
        firstName: 'João',
        lastName: 'Silva',
        userType: 'BASIC',
        status: 'ACTIVE',
      },
    };

    it('deve fazer login com sucesso', async () => {
      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('deve lançar erro se credenciais forem inválidas', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciais inválidas'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-123',
        phone: '+244123456789',
        firstName: 'João',
        lastName: 'Silva',
        userType: 'BASIC',
        status: 'ACTIVE',
      },
    };

    it('deve renovar token com sucesso', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockResponse);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(mockResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
    });

    it('deve lançar erro se token for inválido', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Token inválido'),
      );

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePin', () => {
    const changePinDto: ChangePinDto = {
      currentPin: '1234',
      newPin: '5678',
    };

    const mockResponse = {
      message: 'PIN alterado com sucesso',
    };

    it('deve alterar PIN com sucesso', async () => {
      mockAuthService.changePin.mockResolvedValue(mockResponse);

      const result = await controller.changePin(mockRequest as any, changePinDto);

      expect(result).toEqual(mockResponse);
      expect(authService.changePin).toHaveBeenCalledWith(mockRequest.user.id, changePinDto);
    });

    it('deve lançar erro se PIN atual estiver incorreto', async () => {
      mockAuthService.changePin.mockRejectedValue(
        new BadRequestException('PIN atual incorreto'),
      );

      await expect(controller.changePin(mockRequest as any, changePinDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getProfile', () => {
    it('deve retornar perfil do usuário autenticado', async () => {
      const result = await controller.getProfile(mockRequest as any);

      expect(result).toEqual(mockRequest.user);
    });
  });
});

