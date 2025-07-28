import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { 
  RequestValidationDto, 
  ValidateUserDto, 
  UpdateUserDto, 
  UserResponseDto,
  ValidationRequestDto 
} from './dto/users.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
    @InjectQueue('validation-queue') private validationQueue: Queue,
    @InjectQueue('premium-upgrade-queue') private premiumUpgradeQueue: Queue,
  ) {}

  async findById(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.mapToUserResponse(user);
  }

  async findByPhone(phone: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.mapToUserResponse(user);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
    });

    return this.mapToUserResponse(user);
  }

  async requestValidation(requestValidationDto: RequestValidationDto): Promise<{ message: string }> {
    const { userId } = requestValidationDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.userType !== 'BASIC') {
      throw new BadRequestException('Apenas usuários básicos podem solicitar validação');
    }

    if (user.status !== 'PENDING') {
      throw new BadRequestException('Usuário não está pendente de validação');
    }

    // Buscar usuários premium próximos (simulado - em produção seria baseado em localização)
    const premiumUsers = await this.prisma.user.findMany({
      where: {
        userType: 'PREMIUM',
        status: 'ACTIVE',
      },
      take: 10,
    });

    if (premiumUsers.length < 2) {
      throw new BadRequestException('Não há validadores premium disponíveis');
    }

    // Criar solicitações de validação
    const validationRequests = await Promise.all(
      premiumUsers.slice(0, 2).map(validator =>
        this.prisma.validation.create({
          data: {
            userId,
            validatorId: validator.id,
            status: 'PENDING',
          },
        })
      )
    );

    // Enviar notificações para validadores
    for (const validator of premiumUsers.slice(0, 2)) {
      await this.notificationsService.createNotification({
        userId: validator.id,
        type: 'VALIDATION_REQUEST',
        title: 'Nova solicitação de validação',
        message: `Você tem uma nova solicitação de validação de ${user.firstName} ${user.lastName}`,
        data: {
          validationId: validationRequests.find(v => v.validatorId === validator.id)?.id,
          requesterId: userId,
          requesterName: `${user.firstName} ${user.lastName}`,
        },
      });
    }

    // Agendar job para verificar se validação expirou (7 dias)
    await this.validationQueue.add(
      'check-validation-expiry',
      { userId, validationIds: validationRequests.map(v => v.id) },
      { delay: 7 * 24 * 60 * 60 * 1000 } // 7 dias
    );

    return { message: 'Solicitação de validação enviada com sucesso' };
  }

  async validateUser(validatorId: string, validateUserDto: ValidateUserDto): Promise<{ message: string }> {
    const { userId, status, notes } = validateUserDto;

    // Verificar se o validador é premium
    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator || validator.userType !== 'PREMIUM') {
      throw new ForbiddenException('Apenas usuários premium podem validar');
    }

    // Buscar validação
    const validation = await this.prisma.validation.findFirst({
      where: {
        userId,
        validatorId,
        status: 'PENDING',
      },
    });

    if (!validation) {
      throw new NotFoundException('Solicitação de validação não encontrada');
    }

    // Atualizar validação
    await this.prisma.validation.update({
      where: { id: validation.id },
      data: {
        status,
        notes,
      },
    });

    // Se aprovado, atualizar score do usuário
    if (status === 'APPROVED') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          validationScore: {
            increment: 1,
          },
          validators: {
            push: validatorId,
          },
        },
      });

      // Verificar se usuário pode ser ativado
      await this.checkAndActivateUser(userId);

      // Recompensar validador (50 AOA)
      await this.rewardValidator(validatorId, userId);
    }

    // Notificar usuário sobre a validação
    // const _user = await this.prisma.user.findUnique({
    //   where: { id: userId },
    // });

    await this.notificationsService.createNotification({
      userId,
      type: 'VALIDATION_COMPLETED',
      title: 'Validação concluída',
      message: `Sua validação foi ${status === 'APPROVED' ? 'aprovada' : 'rejeitada'} por ${validator.firstName} ${validator.lastName}`,
      data: {
        validatorId,
        validatorName: `${validator.firstName} ${validator.lastName}`,
        status,
        notes,
      },
    });

    return { message: `Usuário ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso` };
  }

  async getValidationRequests(validatorId: string): Promise<ValidationRequestDto[]> {
    const validations = await this.prisma.validation.findMany({
      where: {
        validatorId,
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

    return validations.map(validation => ({
      id: validation.id,
      userId: validation.userId,
      validatorId: validation.validatorId,
      status: validation.status,
      notes: validation.notes,
      createdAt: validation.createdAt,
      user: validation.user,
    }));
  }

  async getPendingValidations(userId: string): Promise<ValidationRequestDto[]> {
    const validations = await this.prisma.validation.findMany({
      where: {
        userId,
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

    return validations.map(validation => ({
      id: validation.id,
      userId: validation.userId,
      validatorId: validation.validatorId,
      status: validation.status,
      notes: validation.notes,
      createdAt: validation.createdAt,
      user: validation.validator,
    }));
  }

  private async checkAndActivateUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    // Verificar se tem pelo menos 2 validações aprovadas
    const approvedValidations = await this.prisma.validation.count({
      where: {
        userId,
        status: 'APPROVED',
      },
    });

    if (approvedValidations >= 2) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
        },
      });

      // Notificar usuário sobre ativação
      await this.notificationsService.createNotification({
        userId,
        type: 'VALIDATION_COMPLETED',
        title: 'Conta ativada',
        message: 'Sua conta foi ativada com sucesso! Você já pode usar todos os recursos do PaySmart.',
      });

      // Agendar verificação de upgrade para premium
      await this.premiumUpgradeQueue.add(
        'check-premium-eligibility',
        { userId },
        { delay: 24 * 60 * 60 * 1000 } // 24 horas
      );
    }
  }

  private async rewardValidator(validatorId: string, validatedUserId: string): Promise<void> {
    try {
      // Buscar carteiras dos usuários
      const [validatorWallet, validatedUserWallet] = await Promise.all([
        this.prisma.wallet.findFirst({
          where: { userId: validatorId, isDefault: true },
        }),
        this.prisma.wallet.findFirst({
          where: { userId: validatedUserId, isDefault: true },
        }),
      ]);

      if (!validatorWallet || !validatedUserWallet) {
        console.error('Carteiras não encontradas para recompensa de validação');
        return;
      }

      // Criar transação de recompensa (50 AOA)
      await this.transactionsService.createTransaction({
        fromWalletId: validatedUserWallet.id,
        toWalletId: validatorWallet.id,
        fromUserId: validatedUserId,
        toUserId: validatorId,
        type: 'VALIDATION_REWARD',
        amount: 50,
        currency: 'AOA',
        description: 'Recompensa por validação de usuário',
        notes: 'Recompensa automática por validar um usuário básico',
      });

      // Notificar validador sobre a recompensa
      await this.notificationsService.createNotification({
        userId: validatorId,
        type: 'VALIDATION_REWARD',
        title: 'Recompensa recebida',
        message: 'Você recebeu 50 AOA como recompensa por validar um usuário',
        data: {
          amount: 50,
          currency: 'AOA',
          validatedUserId,
        },
      });
    } catch (error) {
      console.error('Erro ao processar recompensa de validação:', error);
    }
  }

  private mapToUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      userType: user.userType,
      status: user.status,
      validationScore: user.validationScore,
      validators: user.validators,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
} 