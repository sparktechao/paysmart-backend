import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { getQueueToken } from '@nestjs/bull';
import {
  RequestValidationDto,
  ValidateUserDto,
  UpdateUserDto,
} from './dto/users.dto';
import { UserType, UserStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;
  let validationQueue: any;

  const mockUserId = 'user-123';
  const mockValidatorId = 'validator-456';
  const mockValidationId = 'validation-789';

  const mockUser = {
    id: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    phone: '+244123456789',
    email: 'john@example.com',
    userType: UserType.BASIC,
    status: UserStatus.PENDING,
    validationScore: 0,
    validators: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPremiumUser = {
    id: mockValidatorId,
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+244987654321',
    email: 'jane@example.com',
    userType: UserType.PREMIUM,
    status: UserStatus.ACTIVE,
    validationScore: 10,
    validators: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockValidation = {
    id: mockValidationId,
    userId: mockUserId,
    validatorId: mockValidatorId,
    status: 'PENDING',
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    validation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
  };

  const mockValidationQueue = {
    add: jest.fn(),
  };

  const mockPremiumUpgradeQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
        {
          provide: getQueueToken('validation-queue'),
          useValue: mockValidationQueue,
        },
        {
          provide: getQueueToken('premium-upgrade-queue'),
          useValue: mockPremiumUpgradeQueue,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(
      NotificationsService
    );
    validationQueue = mockValidationQueue;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(mockUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUserId);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findByPhone', () => {
    it('should return a user by phone', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByPhone(mockUser.phone);

      expect(result).toBeDefined();
      expect(result.phone).toBe(mockUser.phone);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: mockUser.phone },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByPhone('+244999999999')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateUser', () => {
    const updateDto: UpdateUserDto = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser(mockUserId, updateDto);

      expect(result.firstName).toBe(updateDto.firstName);
      expect(result.lastName).toBe(updateDto.lastName);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: updateDto,
      });
    });

    it('should handle update errors', async () => {
      mockPrismaService.user.update.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(service.updateUser(mockUserId, updateDto)).rejects.toThrow();
    });
  });

  describe('requestValidation', () => {
    const requestDto: RequestValidationDto = {
      userId: mockUserId,
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue([
        mockPremiumUser,
        { ...mockPremiumUser, id: 'validator-2' },
      ]);
      mockPrismaService.validation.create.mockResolvedValue(mockValidation);
      mockNotificationsService.createNotification.mockResolvedValue({});
      mockValidationQueue.add.mockResolvedValue({});
    });

    it('should create validation request successfully', async () => {
      const result = await service.requestValidation(requestDto);

      expect(result.message).toContain('Solicitação de validação enviada');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          userType: UserType.PREMIUM,
          status: UserStatus.ACTIVE,
        },
        take: 10,
      });
      expect(prisma.validation.create).toHaveBeenCalledTimes(2);
      expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
      expect(validationQueue.add).toHaveBeenCalledWith(
        'check-validation-expiry',
        expect.any(Object),
        { delay: 7 * 24 * 60 * 60 * 1000 }
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.requestValidation(requestDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException for non-BASIC users', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userType: UserType.PREMIUM,
      });

      await expect(service.requestValidation(requestDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when user is not PENDING', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      await expect(service.requestValidation(requestDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when not enough validators', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockPremiumUser]);

      await expect(service.requestValidation(requestDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateUser', () => {
    const validateDto: ValidateUserDto = {
      userId: mockUserId,
      status: 'APPROVED',
      notes: 'User validated successfully',
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockPremiumUser);
      mockPrismaService.validation.findFirst.mockResolvedValue(mockValidation);
      mockPrismaService.validation.count.mockResolvedValue(2);
      mockPrismaService.validation.update.mockResolvedValue({
        ...mockValidation,
        status: 'APPROVED',
      });
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockNotificationsService.createNotification.mockResolvedValue({});
      mockTransactionsService.createTransaction.mockResolvedValue({});
    });

    it('should validate user successfully when APPROVED', async () => {
      const result = await service.validateUser(mockValidatorId, validateDto);

      expect(result.message).toContain('aprovado com sucesso');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockValidatorId },
      });
      expect(prisma.validation.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          validatorId: mockValidatorId,
          status: 'PENDING',
        },
      });
      expect(prisma.validation.update).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('should reject user successfully when REJECTED', async () => {
      const rejectDto: ValidateUserDto = {
        ...validateDto,
        status: 'REJECTED',
      };

      const result = await service.validateUser(mockValidatorId, rejectDto);

      expect(result.message).toContain('rejeitado com sucesso');
      expect(prisma.validation.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when validator is not PREMIUM', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockPremiumUser,
        userType: UserType.BASIC,
      });

      await expect(
        service.validateUser(mockValidatorId, validateDto)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when validation not found', async () => {
      mockPrismaService.validation.findFirst.mockResolvedValue(null);

      await expect(
        service.validateUser(mockValidatorId, validateDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when validator not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser(mockValidatorId, validateDto)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getValidationRequests', () => {
    it('should return validation requests for a validator', async () => {
      const mockValidations = [
        {
          ...mockValidation,
          user: {
            firstName: 'John',
            lastName: 'Doe',
            phone: '+244123456789',
          },
        },
      ];
      mockPrismaService.validation.findMany.mockResolvedValue(mockValidations);

      const result = await service.getValidationRequests(mockValidatorId);

      expect(result).toHaveLength(1);
      expect(result[0].validatorId).toBe(mockValidatorId);
      expect(prisma.validation.findMany).toHaveBeenCalledWith({
        where: {
          validatorId: mockValidatorId,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      });
    });

    it('should return empty array when no pending validations', async () => {
      mockPrismaService.validation.findMany.mockResolvedValue([]);

      const result = await service.getValidationRequests(mockValidatorId);

      expect(result).toEqual([]);
    });
  });

  describe('getPendingValidations', () => {
    it('should return pending validations for a user', async () => {
      const mockValidations = [
        {
          ...mockValidation,
          validator: {
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+244987654321',
          },
        },
      ];
      mockPrismaService.validation.findMany.mockResolvedValue(mockValidations);

      const result = await service.getPendingValidations(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
      expect(prisma.validation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          status: 'PENDING',
        },
        include: {
          validator: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      });
    });

    it('should return empty array when no pending validations', async () => {
      mockPrismaService.validation.findMany.mockResolvedValue([]);

      const result = await service.getPendingValidations(mockUserId);

      expect(result).toEqual([]);
    });
  });
});
