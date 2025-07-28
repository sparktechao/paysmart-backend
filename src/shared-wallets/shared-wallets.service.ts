import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { SharedWalletResponseDto } from './dto/shared-wallets.dto';

@Injectable()
export class SharedWalletsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
  ) {}

  async createSharedWallet(data: {
    name: string;
    description?: string;
    walletId: string;
    ownerId: string;
    members: Array<{
      userId: string;
      role: 'ADMIN' | 'MEMBER';
      permissions: {
        canSend: boolean;
        canReceive: boolean;
        canView: boolean;
        canManage: boolean;
      };
    }>;
  }): Promise<SharedWalletResponseDto> {
    // Verificar se a carteira existe e pertence ao owner
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: data.walletId,
        userId: data.ownerId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada ou não pertence ao usuário');
    }

    // Verificar se já existe uma carteira compartilhada para esta carteira
    const existingSharedWallet = await this.prisma.sharedWallet.findFirst({
      where: { walletId: data.walletId },
    });

    if (existingSharedWallet) {
      throw new BadRequestException('Esta carteira já possui uma carteira compartilhada');
    }

    // Criar carteira compartilhada
    const sharedWallet = await this.prisma.sharedWallet.create({
      data: {
        name: data.name,
        description: data.description,
        walletId: data.walletId,
        ownerId: data.ownerId,
        members: {
          create: [
            // Adicionar owner como ADMIN
            {
              userId: data.ownerId,
              role: 'OWNER',
              permissions: {
                canSend: true,
                canReceive: true,
                canView: true,
                canManage: true,
              },
            },
            // Adicionar membros
            ...data.members.map(member => ({
              userId: member.userId,
              role: member.role,
              permissions: member.permissions,
            })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        wallet: {
          select: {
            walletNumber: true,
            balances: true,
          },
        },
      },
    });

    // Notificar membros
    await this.notifySharedWalletMembers(sharedWallet.id, 'INVITED', data.members.map(m => m.userId));

    return this.getSharedWalletDetails(sharedWallet.id, data.ownerId);
  }

  async addMember(sharedWalletId: string, userId: string, data: {
    newMemberId: string;
    role: 'ADMIN' | 'MEMBER';
    permissions: {
      canSend: boolean;
      canReceive: boolean;
      canView: boolean;
      canManage: boolean;
    };
  }): Promise<SharedWalletResponseDto> {
    // Verificar se o usuário tem permissão para adicionar membros
    const userMembership = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId,
        OR: [
          { role: 'OWNER' },
          { role: 'ADMIN' },
        ],
      },
    });

    if (!userMembership) {
      throw new ForbiddenException('Você não tem permissão para adicionar membros');
    }

    // Verificar se o novo membro já é membro
    const existingMember = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId: data.newMemberId,
      },
    });

    if (existingMember) {
      throw new BadRequestException('Usuário já é membro desta carteira compartilhada');
    }

    // Adicionar novo membro
    await this.prisma.sharedWalletMember.create({
      data: {
        sharedWalletId,
        userId: data.newMemberId,
        role: data.role,
        permissions: data.permissions,
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

    // Notificar novo membro
    await this.notificationsService.createNotification({
      userId: data.newMemberId,
      type: 'PAYMENT_REQUEST',
      title: 'Convite para Carteira Compartilhada',
      message: `Você foi convidado para participar de uma carteira compartilhada`,
      data: {
        sharedWalletId,
        role: data.role,
        permissions: data.permissions,
      },
    });

    return this.getSharedWalletDetails(sharedWalletId, userId);
  }

  async removeMember(sharedWalletId: string, userId: string, memberIdToRemove: string): Promise<void> {
    // Verificar se o usuário tem permissão para remover membros
    const userMembership = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId,
        OR: [
          { role: 'OWNER' },
          { role: 'ADMIN' },
        ],
      },
    });

    if (!userMembership) {
      throw new ForbiddenException('Você não tem permissão para remover membros');
    }

    // Verificar se está tentando remover o owner
    const memberToRemove = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId: memberIdToRemove,
      },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Membro não encontrado');
    }

    if (memberToRemove.role === 'OWNER') {
      throw new BadRequestException('Não é possível remover o proprietário da carteira');
    }

    // Remover membro
    await this.prisma.sharedWalletMember.delete({
      where: { id: memberToRemove.id },
    });

    // Notificar membro removido
    await this.notificationsService.createNotification({
      userId: memberIdToRemove,
      type: 'SECURITY_ALERT',
      title: 'Removido da Carteira Compartilhada',
      message: `Você foi removido da carteira compartilhada`,
      data: { sharedWalletId },
    });

    // Membro removido com sucesso
  }

  async updateMember(sharedWalletId: string, memberId: string, userId: string, data: {
    role?: 'ADMIN' | 'MEMBER';
    permissions?: {
      canSend: boolean;
      canReceive: boolean;
      canView: boolean;
      canManage: boolean;
    };
  }): Promise<SharedWalletResponseDto> {
    await this.updateMemberPermissions(sharedWalletId, userId, {
      memberId,
      role: data.role,
      permissions: data.permissions,
    });
    return this.getSharedWalletDetails(sharedWalletId, userId);
  }

  async updateMemberPermissions(sharedWalletId: string, userId: string, data: {
    memberId: string;
    role?: 'ADMIN' | 'MEMBER';
    permissions?: {
      canSend: boolean;
      canReceive: boolean;
      canView: boolean;
      canManage: boolean;
    };
  }) {
    // Verificar se o usuário tem permissão para atualizar membros
    const userMembership = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId,
        OR: [
          { role: 'OWNER' },
          { role: 'ADMIN' },
        ],
      },
    });

    if (!userMembership) {
      throw new ForbiddenException('Você não tem permissão para atualizar membros');
    }

    // Verificar se está tentando atualizar o owner
    const memberToUpdate = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId: data.memberId,
      },
    });

    if (!memberToUpdate) {
      throw new NotFoundException('Membro não encontrado');
    }

    if (memberToUpdate.role === 'OWNER') {
      throw new BadRequestException('Não é possível alterar as permissões do proprietário');
    }

    // Atualizar membro
    const updatedMember = await this.prisma.sharedWalletMember.update({
      where: { id: memberToUpdate.id },
      data: {
        role: data.role,
        permissions: data.permissions,
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

    // Notificar membro atualizado
    await this.notificationsService.createNotification({
      userId: data.memberId,
      type: 'SECURITY_ALERT',
      title: 'Permissões Atualizadas',
      message: `Suas permissões na carteira compartilhada foram atualizadas`,
      data: {
        sharedWalletId,
        role: data.role,
        permissions: data.permissions,
      },
    });

    return updatedMember;
  }

  async getSharedWalletById(sharedWalletId: string, userId: string): Promise<SharedWalletResponseDto> {
    return this.getSharedWalletDetails(sharedWalletId, userId);
  }

  async getSharedWalletDetails(sharedWalletId: string, userId: string): Promise<SharedWalletResponseDto> {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id: sharedWalletId,
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        wallet: {
          select: {
            walletNumber: true,
            balances: true,
            status: true,
          },
        },
      },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada');
    }

    const balance = (sharedWallet.wallet.balances as any)['EUR'] || 0;
    
    return {
      id: sharedWallet.id,
      name: sharedWallet.name,
      description: sharedWallet.description || '',
      currency: 'EUR', // Assumindo EUR como moeda padrão
      balance,
      status: 'ACTIVE' as any, // Assumindo que todas as carteiras estão ativas
      minTransactionAmount: 0, // TODO: Implementar
      maxTransactionAmount: 10000, // TODO: Implementar
      walletNumber: sharedWallet.wallet.walletNumber,
      members: sharedWallet.members.map(member => ({
        id: member.id,
        userId: member.userId,
        userName: `${member.user.firstName} ${member.user.lastName}`,
        userEmail: member.user.phone, // Usando phone como email temporariamente
        role: member.role as any,
        permissions: member.permissions as any,
        joinedAt: member.createdAt,
      })),
      createdAt: sharedWallet.createdAt,
      updatedAt: sharedWallet.updatedAt,
    };
  }

  async getUserSharedWallets(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [sharedWallets, total] = await Promise.all([
      this.prisma.sharedWallet.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
          wallet: {
            select: {
              walletNumber: true,
              balances: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sharedWallet.count({
        where: {
          members: {
            some: { userId },
          },
        },
      }),
    ]);

    return {
      sharedWallets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async transferFromSharedWallet(sharedWalletId: string, userId: string, data: {
    toWalletId: string;
    toUserId: string;
    amount: number;
    currency: string;
    description: string;
    notes?: string;
  }) {
    // Verificar se o usuário tem permissão para enviar
    const userMembership = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId,
        permissions: {
          path: ['canSend'],
          equals: true,
        },
      },
    });

    if (!userMembership) {
      throw new ForbiddenException('Você não tem permissão para enviar desta carteira');
    }

    const sharedWallet = await this.prisma.sharedWallet.findUnique({
      where: { id: sharedWalletId },
      include: { wallet: true },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada');
    }

    // Verificar saldo
    const currentBalance = (sharedWallet.wallet.balances as any)[data.currency] || 0;
    if (currentBalance < data.amount) {
      throw new BadRequestException('Saldo insuficiente na carteira compartilhada');
    }

    // Criar transação
    const transaction = await this.transactionsService.createTransaction({
      fromWalletId: sharedWallet.walletId,
      toWalletId: data.toWalletId,
      fromUserId: userId,
      toUserId: data.toUserId,
      type: 'SHARED_WALLET',
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      notes: data.notes,
    });

    // Atualizar saldos
    await this.updateSharedWalletBalances(
      sharedWallet.walletId,
      data.toWalletId,
      data.amount,
      data.currency
    );

    // Notificar membros da carteira compartilhada
    await this.notifySharedWalletTransaction(sharedWalletId, transaction.id, data);

    return transaction;
  }

  async leaveSharedWallet(sharedWalletId: string, userId: string) {
    const membership = await this.prisma.sharedWalletMember.findFirst({
      where: {
        sharedWalletId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Você não é membro desta carteira compartilhada');
    }

    if (membership.role === 'OWNER') {
      throw new BadRequestException('O proprietário não pode sair da carteira compartilhada');
    }

    // Remover membro
    await this.prisma.sharedWalletMember.delete({
      where: { id: membership.id },
    });

    // Notificar outros membros
    const otherMembers = await this.prisma.sharedWalletMember.findMany({
      where: {
        sharedWalletId,
        userId: { not: userId },
      },
    });

    for (const member of otherMembers) {
      await this.notificationsService.createNotification({
        userId: member.userId,
        type: 'SECURITY_ALERT',
        title: 'Membro Saiu da Carteira',
        message: `Um membro saiu da carteira compartilhada`,
        data: { sharedWalletId },
      });
    }

    return { message: 'Você saiu da carteira compartilhada com sucesso' };
  }

  async updateSharedWallet(id: string, userId: string, updateData: any): Promise<SharedWalletResponseDto> {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                role: 'ADMIN',
              },
            },
          },
        ],
      },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada ou sem permissão');
    }

    await this.prisma.sharedWallet.update({
      where: { id },
      data: updateData,
    });

    return this.getSharedWalletDetails(id, userId);
  }

  async deleteSharedWallet(id: string, userId: string): Promise<void> {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada ou sem permissão');
    }

    // Deletar membros primeiro
    await this.prisma.sharedWalletMember.deleteMany({
      where: { sharedWalletId: id },
    });

    // Deletar carteira compartilhada
    await this.prisma.sharedWallet.delete({
      where: { id },
    });
  }

  async getMembers(id: string, userId: string) {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada');
    }

    return sharedWallet.members;
  }

  async getSharedWalletTransactions(id: string, userId: string, page: number = 1, limit: number = 10) {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada');
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          OR: [
            { fromWalletId: sharedWallet.walletId },
            { toWalletId: sharedWallet.walletId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { fromWalletId: sharedWallet.walletId },
            { toWalletId: sharedWallet.walletId },
          ],
        },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deposit(id: string, userId: string, depositData: { amount: number; description?: string }) {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                permissions: { path: ['canSend'], equals: true },
              },
            },
          },
        ],
      },
      include: { wallet: true },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada ou sem permissão');
    }

    // Criar transação de depósito
    await this.transactionsService.createTransaction({
      fromWalletId: sharedWallet.walletId,
      toWalletId: sharedWallet.walletId,
      fromUserId: userId,
      toUserId: userId,
      type: 'DEPOSIT',
      amount: depositData.amount,
      currency: 'EUR', // Assumindo EUR como moeda padrão
      description: depositData.description || 'Depósito na carteira compartilhada',
    });

    // Atualizar saldo da carteira
    const currentBalance = (sharedWallet.wallet.balances as any)['EUR'] || 0;
    await this.prisma.wallet.update({
      where: { id: sharedWallet.walletId },
      data: {
        balances: {
          EUR: currentBalance + depositData.amount,
        },
      },
    });

    return this.getSharedWalletDetails(id, userId);
  }

  async withdraw(id: string, userId: string, withdrawData: { amount: number; description?: string }) {
    const sharedWallet = await this.prisma.sharedWallet.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                permissions: { path: ['canSend'], equals: true },
              },
            },
          },
        ],
      },
      include: { wallet: true },
    });

    if (!sharedWallet) {
      throw new NotFoundException('Carteira compartilhada não encontrada ou sem permissão');
    }

    const currentBalance = (sharedWallet.wallet.balances as any)['EUR'] || 0;
    if (currentBalance < withdrawData.amount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    // Criar transação de saque
    await this.transactionsService.createTransaction({
      fromWalletId: sharedWallet.walletId,
      toWalletId: sharedWallet.walletId,
      fromUserId: userId,
      toUserId: userId,
      type: 'WITHDRAW',
      amount: withdrawData.amount,
      currency: 'EUR',
      description: withdrawData.description || 'Saque da carteira compartilhada',
    });

    // Atualizar saldo da carteira
    await this.prisma.wallet.update({
      where: { id: sharedWallet.walletId },
      data: {
        balances: {
          EUR: currentBalance - withdrawData.amount,
        },
      },
    });

    return this.getSharedWalletDetails(id, userId);
  }

  async getSharedWalletStats(userId: string, filter: any = {}) {
    const where = {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: { userId },
          },
        },
      ],
      ...(filter.status && { status: filter.status }),
      ...(filter.currency && { currency: filter.currency }),
    };

    const [
      totalWallets,
      activeWallets,
      totalMembers,
    ] = await Promise.all([
      this.prisma.sharedWallet.count({ where }),
      this.prisma.sharedWallet.count({ where }),
      this.prisma.sharedWalletMember.count({
        where: {
          sharedWalletId: { in: await this.getUserSharedWalletIds(userId) },
        },
      }),
    ]);

    return {
      totalWallets,
      activeWallets,
      totalMembers,
      averageMembersPerWallet: totalWallets > 0 ? totalMembers / totalWallets : 0,
    };
  }

  private async updateSharedWalletBalances(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    currency: string
  ) {
    await this.prisma.$transaction(async (prisma) => {
      // Buscar carteiras atuais
      const fromWallet = await prisma.wallet.findUnique({
        where: { id: fromWalletId },
        select: { balances: true },
      });
      
      const toWallet = await prisma.wallet.findUnique({
        where: { id: toWalletId },
        select: { balances: true },
      });

      if (!fromWallet || !toWallet) {
        throw new Error('Carteira não encontrada');
      }

      // Calcular novos saldos
      const fromBalance = (fromWallet.balances as any)[currency] || 0;
      const toBalance = (toWallet.balances as any)[currency] || 0;

      const newFromBalance = fromBalance - amount;
      const newToBalance = toBalance + amount;

      // Atualizar carteiras
      await prisma.wallet.update({
        where: { id: fromWalletId },
        data: {
                      balances: {
              ...(fromWallet.balances as any),
              [currency]: newFromBalance,
            },
        },
      });

      await prisma.wallet.update({
        where: { id: toWalletId },
        data: {
                      balances: {
              ...(toWallet.balances as any),
              [currency]: newToBalance,
            },
        },
      });
    });
  }

  private async notifySharedWalletMembers(
    sharedWalletId: string,
    action: string,
    userIds: string[]
  ) {
    for (const userId of userIds) {
      await this.notificationsService.createNotification({
        userId,
        type: 'PAYMENT_REQUEST',
        title: 'Carteira Compartilhada',
        message: `Você foi ${action.toLowerCase()} para uma carteira compartilhada`,
        data: { sharedWalletId, action },
      });
    }
  }

  private async notifySharedWalletTransaction(
    sharedWalletId: string,
    transactionId: string,
    data: any
  ) {
    const members = await this.prisma.sharedWalletMember.findMany({
      where: { sharedWalletId },
    });

    for (const member of members) {
      await this.notificationsService.createNotification({
        userId: member.userId,
        type: 'PAYMENT_SENT',
        title: 'Transação da Carteira Compartilhada',
        message: `Transação de ${data.amount} ${data.currency} realizada da carteira compartilhada`,
        data: {
          sharedWalletId,
          transactionId,
          amount: data.amount,
          currency: data.currency,
        },
      });
    }
  }

  private async getUserSharedWalletIds(userId: string): Promise<string[]> {
    const sharedWallets = await this.prisma.sharedWallet.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      select: { id: true },
    });
    return sharedWallets.map(wallet => wallet.id);
  }
}
