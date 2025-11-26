import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  RequestValidationDto,
  ValidateUserDto,
  UpdateUserDto,
  UserResponseDto,
  ValidationRequestDto,
} from './dto/users.dto';
import { UserType, UserStatus } from '@prisma/client';
import { Request } from 'express';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUserId = 'user-123';
  const mockValidatorId = 'validator-456';

  const mockRequest = {
    user: { id: mockUserId },
  } as unknown as Request;

  const mockUser: UserResponseDto = {
    id: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    phone: '+244123456789',
    email: 'john@example.com',
    userType: UserType.BASIC,
    status: UserStatus.ACTIVE,
    validationScore: 2,
    validators: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUsersService = {
    findById: jest.fn(),
    findByPhone: jest.fn(),
    updateUser: jest.fn(),
    requestValidation: jest.fn(),
    validateUser: jest.fn(),
    getValidationRequests: jest.fn(),
    getPendingValidations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return authenticated user profile', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith(mockUserId);
      expect(service.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user not found', async () => {
      mockUsersService.findById.mockRejectedValue(new Error('User not found'));

      await expect(controller.getProfile(mockRequest)).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(result).toEqual(updatedUser);
      expect(service.updateUser).toHaveBeenCalledWith(mockUserId, updateDto);
      expect(service.updateUser).toHaveBeenCalledTimes(1);
    });

    it('should update email only', async () => {
      const emailDto: UpdateUserDto = { email: 'newemail@example.com' };
      const updatedUser = { ...mockUser, email: emailDto.email };
      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockRequest, emailDto);

      expect(result.email).toBe(emailDto.email);
      expect(service.updateUser).toHaveBeenCalledWith(mockUserId, emailDto);
    });

    it('should handle update errors', async () => {
      mockUsersService.updateUser.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        controller.updateProfile(mockRequest, updateDto)
      ).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserById(mockUserId);

      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw error when user not found', async () => {
      mockUsersService.findById.mockRejectedValue(new Error('User not found'));

      await expect(controller.getUserById('non-existent')).rejects.toThrow();
    });
  });

  describe('getUserByPhone', () => {
    it('should return user by phone', async () => {
      const phone = '+244123456789';
      mockUsersService.findByPhone.mockResolvedValue(mockUser);

      const result = await controller.getUserByPhone(phone);

      expect(result).toEqual(mockUser);
      expect(service.findByPhone).toHaveBeenCalledWith(phone);
    });

    it('should throw error when user not found', async () => {
      mockUsersService.findByPhone.mockRejectedValue(
        new Error('User not found')
      );

      await expect(
        controller.getUserByPhone('+244999999999')
      ).rejects.toThrow();
    });

    it('should handle invalid phone format', async () => {
      const invalidPhone = 'invalid-phone';
      mockUsersService.findByPhone.mockRejectedValue(
        new Error('Invalid phone format')
      );

      await expect(controller.getUserByPhone(invalidPhone)).rejects.toThrow();
    });
  });

  describe('requestValidation', () => {
    const requestDto: RequestValidationDto = {
      userId: mockUserId,
    };

    it('should request validation successfully', async () => {
      const mockResponse = {
        message: 'Solicitação de validação enviada com sucesso',
      };
      mockUsersService.requestValidation.mockResolvedValue(mockResponse);

      const result = await controller.requestValidation(mockRequest, requestDto);

      expect(result).toEqual(mockResponse);
      expect(service.requestValidation).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });

    it('should throw error for non-BASIC users', async () => {
      mockUsersService.requestValidation.mockRejectedValue(
        new Error('Only BASIC users can request validation')
      );

      await expect(
        controller.requestValidation(mockRequest, requestDto)
      ).rejects.toThrow();
    });

    it('should throw error when user is not PENDING', async () => {
      mockUsersService.requestValidation.mockRejectedValue(
        new Error('User is not pending validation')
      );

      await expect(
        controller.requestValidation(mockRequest, requestDto)
      ).rejects.toThrow();
    });

    it('should throw error when not enough validators available', async () => {
      mockUsersService.requestValidation.mockRejectedValue(
        new Error('Not enough premium validators available')
      );

      await expect(
        controller.requestValidation(mockRequest, requestDto)
      ).rejects.toThrow();
    });
  });

  describe('validateUser', () => {
    const validateDto: ValidateUserDto = {
      userId: mockUserId,
      status: 'APPROVED',
      notes: 'User validated successfully',
    };

    it('should validate user successfully when APPROVED', async () => {
      const mockResponse = { message: 'Usuário aprovado com sucesso' };
      mockUsersService.validateUser.mockResolvedValue(mockResponse);

      const result = await controller.validateUser(mockRequest, validateDto);

      expect(result).toEqual(mockResponse);
      expect(service.validateUser).toHaveBeenCalledWith(
        mockUserId,
        validateDto
      );
    });

    it('should reject user successfully when REJECTED', async () => {
      const rejectDto: ValidateUserDto = {
        ...validateDto,
        status: 'REJECTED',
        notes: 'Invalid documents',
      };
      const mockResponse = { message: 'Usuário rejeitado com sucesso' };
      mockUsersService.validateUser.mockResolvedValue(mockResponse);

      const result = await controller.validateUser(mockRequest, rejectDto);

      expect(result).toEqual(mockResponse);
      expect(service.validateUser).toHaveBeenCalledWith(mockUserId, rejectDto);
    });

    it('should throw error when validator is not PREMIUM', async () => {
      mockUsersService.validateUser.mockRejectedValue(
        new Error('Only PREMIUM users can validate')
      );

      await expect(
        controller.validateUser(mockRequest, validateDto)
      ).rejects.toThrow();
    });

    it('should throw error when validation request not found', async () => {
      mockUsersService.validateUser.mockRejectedValue(
        new Error('Validation request not found')
      );

      await expect(
        controller.validateUser(mockRequest, validateDto)
      ).rejects.toThrow();
    });
  });

  describe('getValidationRequests', () => {
    const mockValidationRequests: ValidationRequestDto[] = [
      {
        id: 'validation-1',
        userId: mockUserId,
        validatorId: mockValidatorId,
        status: 'PENDING',
        notes: null,
        createdAt: new Date('2024-01-01'),
        user: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+244123456789',
        },
      },
    ];

    it('should return validation requests for premium user', async () => {
      mockUsersService.getValidationRequests.mockResolvedValue(
        mockValidationRequests
      );

      const result = await controller.getValidationRequests(mockRequest);

      expect(result).toEqual(mockValidationRequests);
      expect(service.getValidationRequests).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty array when no pending requests', async () => {
      mockUsersService.getValidationRequests.mockResolvedValue([]);

      const result = await controller.getValidationRequests(mockRequest);

      expect(result).toEqual([]);
      expect(service.getValidationRequests).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw error when user is not premium', async () => {
      mockUsersService.getValidationRequests.mockRejectedValue(
        new Error('User is not premium')
      );

      await expect(
        controller.getValidationRequests(mockRequest)
      ).rejects.toThrow();
    });
  });

  describe('getPendingValidations', () => {
    const mockPendingValidations: ValidationRequestDto[] = [
      {
        id: 'validation-1',
        userId: mockUserId,
        validatorId: mockValidatorId,
        status: 'PENDING',
        notes: null,
        createdAt: new Date('2024-01-01'),
        user: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+244987654321',
        },
      },
    ];

    it('should return pending validations for user', async () => {
      mockUsersService.getPendingValidations.mockResolvedValue(
        mockPendingValidations
      );

      const result = await controller.getPendingValidations(mockRequest);

      expect(result).toEqual(mockPendingValidations);
      expect(service.getPendingValidations).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty array when no pending validations', async () => {
      mockUsersService.getPendingValidations.mockResolvedValue([]);

      const result = await controller.getPendingValidations(mockRequest);

      expect(result).toEqual([]);
      expect(service.getPendingValidations).toHaveBeenCalledWith(mockUserId);
    });
  });
});
