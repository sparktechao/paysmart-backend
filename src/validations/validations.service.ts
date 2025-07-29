import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ValidationDto {
  id: string;
  userId: string;
  validatorId: string;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    userType: string;
    status: string;
  };
  validator: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export interface ValidationStatsDto {
  totalValidations: number;
  approvedValidations: number;
  rejectedValidations: number;
  pendingValidations: number;
  approvalRate: number;
}

@Injectable()
export class ValidationsService {
  constructor(private prisma: PrismaService) {}

  async getPendingValidations(validatorId: string): Promise<ValidationDto[]> {
    // Verificar se o usuário é premium
    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator || validator.userType !== 'PREMIUM') {
      throw new ForbiddenException('Apenas usuários premium podem ver validações pendentes');
    }

    const validations = await this.prisma.validation.findMany({
      where: {
        validatorId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return validations.map(validation => ({
      id: validation.id,
      userId: validation.userId,
      validatorId: validation.validatorId,
      status: validation.status,
      notes: validation.notes,
      createdAt: validation.createdAt,
      updatedAt: validation.updatedAt,
      user: validation.user,
      validator: validation.validator,
    }));
  }

  async getMyValidationRequests(userId: string): Promise<ValidationDto[]> {
    const validations = await this.prisma.validation.findMany({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return validations.map(validation => ({
      id: validation.id,
      userId: validation.userId,
      validatorId: validation.validatorId,
      status: validation.status,
      notes: validation.notes,
      createdAt: validation.createdAt,
      updatedAt: validation.updatedAt,
      user: validation.user,
      validator: validation.validator,
    }));
  }

  async approveValidation(validationId: string, validatorId: string, notes?: string): Promise<ValidationDto> {
    // Verificar se o usuário é premium
    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator || validator.userType !== 'PREMIUM') {
      throw new ForbiddenException('Apenas usuários premium podem aprovar validações');
    }

    // Buscar validação
    const validation = await this.prisma.validation.findFirst({
      where: {
        id: validationId,
        validatorId,
        status: 'PENDING',
      },
      include: {
        user: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!validation) {
      throw new NotFoundException('Validação não encontrada ou já processada');
    }

    // Executar transação para aprovar validação e ativar usuário
    const result = await this.prisma.$transaction(async (prisma) => {
      // Atualizar validação
      const updatedValidation = await prisma.validation.update({
        where: { id: validationId },
        data: {
          status: 'APPROVED',
          notes: notes || 'Validação aprovada',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              userType: true,
              status: true,
            },
          },
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      });

      // Ativar usuário
      await prisma.user.update({
        where: { id: validation.userId },
        data: {
          status: 'ACTIVE',
          validators: {
            push: validatorId,
          },
        },
      });

      return updatedValidation;
    });

    return {
      id: result.id,
      userId: result.userId,
      validatorId: result.validatorId,
      status: result.status,
      notes: result.notes,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      user: result.user,
      validator: result.validator,
    };
  }

  async rejectValidation(validationId: string, validatorId: string, notes: string): Promise<ValidationDto> {
    // Verificar se o usuário é premium
    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator || validator.userType !== 'PREMIUM') {
      throw new ForbiddenException('Apenas usuários premium podem rejeitar validações');
    }

    // Buscar validação
    const validation = await this.prisma.validation.findFirst({
      where: {
        id: validationId,
        validatorId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!validation) {
      throw new NotFoundException('Validação não encontrada ou já processada');
    }

    // Atualizar validação
    const result = await this.prisma.validation.update({
      where: { id: validationId },
      data: {
        status: 'REJECTED',
        notes: notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
          },
        },
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    return {
      id: result.id,
      userId: result.userId,
      validatorId: result.validatorId,
      status: result.status,
      notes: result.notes,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      user: result.user,
      validator: result.validator,
    };
  }

  async getValidationStats(validatorId: string): Promise<ValidationStatsDto> {
    // Verificar se o usuário é premium
    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
    });

    if (!validator || validator.userType !== 'PREMIUM') {
      throw new ForbiddenException('Apenas usuários premium podem ver estatísticas de validações');
    }

    const [total, approved, rejected, pending] = await Promise.all([
      this.prisma.validation.count({
        where: { validatorId },
      }),
      this.prisma.validation.count({
        where: { validatorId, status: 'APPROVED' },
      }),
      this.prisma.validation.count({
        where: { validatorId, status: 'REJECTED' },
      }),
      this.prisma.validation.count({
        where: { validatorId, status: 'PENDING' },
      }),
    ]);

    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    return {
      totalValidations: total,
      approvedValidations: approved,
      rejectedValidations: rejected,
      pendingValidations: pending,
      approvalRate: Math.round(approvalRate * 100) / 100, // Arredondar para 2 casas decimais
    };
  }
}