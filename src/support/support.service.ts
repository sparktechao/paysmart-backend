import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketCategory, TicketPriority, TicketStatus } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createTicket(userId: string, createTicketDto: any) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: createTicketDto.title,
        description: createTicketDto.description,
        category: createTicketDto.category,
        priority: createTicketDto.priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    // Notificar usuário sobre criação do ticket
    await this.notificationsService.createNotification({
      userId,
      type: 'REMINDER',
      title: 'Ticket de Suporte Criado',
      message: `Seu ticket "${createTicketDto.title}" foi criado com sucesso. Número: #${ticket.id.slice(-8)}`,
      data: {
        ticketId: ticket.id,
        subject: createTicketDto.title,
        category: createTicketDto.category,
      },
    });

    // Notificar administradores sobre novo ticket
    await this.notifyAdminsAboutNewTicket(ticket);

    return {
      id: ticket.id,
      userId: ticket.userId,
      title: ticket.subject,
      description: ticket.description,
      category: ticket.category as TicketCategory,
      priority: ticket.priority as TicketPriority,
      status: ticket.status as TicketStatus,
      assignedTo: ticket.assignedTo,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    };
  }

  async createSupportTicket(data: {
    userId: string;
    subject: string;
    description: string;
    category: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    attachments?: string[];
  }) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: data.userId,
        subject: data.subject,
        description: data.description,
        category: data.category as TicketCategory,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    // Notificar usuário sobre criação do ticket
    await this.notificationsService.createNotification({
      userId: data.userId,
      type: 'REMINDER',
      title: 'Ticket de Suporte Criado',
      message: `Seu ticket "${data.subject}" foi criado com sucesso. Número: #${ticket.id.slice(-8)}`,
      data: {
        ticketId: ticket.id,
        subject: data.subject,
        category: data.category,
      },
    });

    // Notificar administradores sobre novo ticket
    await this.notifyAdminsAboutNewTicket(ticket);

    return ticket;
  }

  async getUserTickets(userId: string, filter: any, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(filter.status && { status: filter.status }),
      ...(filter.priority && { priority: filter.priority }),
      ...(filter.category && { category: filter.category }),
      ...(filter.startDate && filter.endDate && {
        createdAt: {
          gte: new Date(filter.startDate),
          lte: new Date(filter.endDate),
        },
      }),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        userId: ticket.userId,
        title: ticket.subject,
        description: ticket.description,
        category: ticket.category as TicketCategory,
        priority: ticket.priority as TicketPriority,
        status: ticket.status as TicketStatus,
        assignedTo: ticket.assignedTo,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTicketById(id: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            userType: true,
            status: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    return {
      id: ticket.id,
      userId: ticket.userId,
      title: ticket.subject,
      description: ticket.description,
      category: ticket.category as TicketCategory,
      priority: ticket.priority as TicketPriority,
      status: ticket.status as TicketStatus,
      assignedTo: ticket.assignedTo,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    };
  }

  async updateTicket(id: string, userId: string, updateTicketDto: any) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { assignedTo: userId },
        ],
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado ou sem permissão');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(updateTicketDto.title && { subject: updateTicketDto.title }),
        ...(updateTicketDto.description && { description: updateTicketDto.description }),
        ...(updateTicketDto.category && { category: updateTicketDto.category }),
        ...(updateTicketDto.priority && { priority: updateTicketDto.priority }),
        ...(updateTicketDto.status && { status: updateTicketDto.status }),
      },
    });

    // Notificar sobre atualização
    await this.notificationsService.createNotification({
      userId: ticket.userId,
      type: 'REMINDER',
      title: 'Ticket Atualizado',
      message: `Seu ticket "${ticket.subject}" foi atualizado`,
      data: {
        ticketId: ticket.id,
        status: updateTicketDto.status,
        assignedTo: updateTicketDto.assignedTo,
      },
    });

    return {
      id: updatedTicket.id,
      userId: updatedTicket.userId,
      title: updatedTicket.subject,
      description: updatedTicket.description,
      category: updatedTicket.category as TicketCategory,
      priority: updatedTicket.priority as TicketPriority,
      status: updatedTicket.status as TicketStatus,
      assignedTo: updatedTicket.assignedTo,
      createdAt: updatedTicket.createdAt,
      updatedAt: updatedTicket.updatedAt,
      resolvedAt: updatedTicket.resolvedAt,
    };
  }

  async replyToTicket(id: string, userId: string, ticketReplyDto: any) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    // Aqui você implementaria a lógica para salvar a resposta
    // Por enquanto, vamos retornar um mock
    const reply = {
      id: 'reply-' + Date.now(),
      ticketId: id,
      userId,
      userName: 'Usuário',
      message: ticketReplyDto.message,
      isInternal: ticketReplyDto.isInternal || false,
      createdAt: new Date(),
    };

    return reply;
  }

  async closeTicket(id: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: 'CLOSED',
      },
    });

    // Notificar usuário sobre fechamento
    await this.notificationsService.createNotification({
      userId: ticket.userId,
      type: 'REMINDER',
      title: 'Ticket Fechado',
      message: `Seu ticket "${ticket.subject}" foi fechado`,
      data: {
        ticketId: ticket.id,
        closedBy: userId,
      },
    });

    return {
      id: updatedTicket.id,
      userId: updatedTicket.userId,
      title: updatedTicket.subject,
      description: updatedTicket.description,
      category: updatedTicket.category as TicketCategory,
      priority: updatedTicket.priority as TicketPriority,
      status: updatedTicket.status as TicketStatus,
      assignedTo: updatedTicket.assignedTo,
      createdAt: updatedTicket.createdAt,
      updatedAt: updatedTicket.updatedAt,
      resolvedAt: updatedTicket.resolvedAt,
    };
  }

  async getTicketReplies(id: string, userId: string, page: number = 1) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    // Aqui você implementaria a lógica para buscar as respostas
    // Por enquanto, vamos retornar um mock
    return {
      replies: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }

  async getCategories() {
    return [
      {
        id: 'account',
        name: 'Conta e Cadastro',
        description: 'Problemas com conta, cadastro, validação',
        icon: 'user',
        isActive: true,
      },
      {
        id: 'wallet',
        name: 'Carteira Digital',
        description: 'Problemas com carteira, saldo, transferências',
        icon: 'wallet',
        isActive: true,
      },
      {
        id: 'transactions',
        name: 'Transações',
        description: 'Problemas com transferências, pagamentos',
        icon: 'credit-card',
        isActive: true,
      },
      {
        id: 'services',
        name: 'Pagamento de Serviços',
        description: 'Problemas com pagamento de contas',
        icon: 'file-text',
        isActive: true,
      },
      {
        id: 'smart-contracts',
        name: 'Smart Contracts',
        description: 'Problemas com contratos inteligentes',
        icon: 'shield',
        isActive: true,
      },
      {
        id: 'rateio',
        name: 'Rateio',
        description: 'Problemas com divisão de despesas',
        icon: 'users',
        isActive: true,
      },
      {
        id: 'rewards',
        name: 'Recompensas',
        description: 'Problemas com recompensas e gamificação',
        icon: 'gift',
        isActive: true,
      },
      {
        id: 'security',
        name: 'Segurança',
        description: 'Problemas de segurança, bloqueios',
        icon: 'lock',
        isActive: true,
      },
      {
        id: 'technical',
        name: 'Problemas Técnicos',
        description: 'Problemas com o aplicativo, bugs',
        icon: 'settings',
        isActive: true,
      },
      {
        id: 'other',
        name: 'Outros',
        description: 'Outros tipos de problemas',
        icon: 'help-circle',
        isActive: true,
      },
    ];
  }

  async getFAQ() {
    return [
      {
        id: '1',
        question: 'Como criar uma conta?',
        answer: 'Para criar uma conta, acesse a tela de cadastro e preencha seus dados pessoais.',
        category: 'account',
      },
      {
        id: '2',
        question: 'Como adicionar dinheiro à carteira?',
        answer: 'Você pode adicionar dinheiro através de PIX, transferência bancária ou cartão de crédito.',
        category: 'wallet',
      },
      {
        id: '3',
        question: 'Como fazer uma transferência?',
        answer: 'Acesse a seção de transferências, escolha o destinatário e informe o valor.',
        category: 'transactions',
      },
    ];
  }

  async getSupportTickets(userId?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSupportTicketDetails(ticketId: string, userId?: string) {
    const where = {
      id: ticketId,
      ...(userId && { userId }),
    };

    const ticket = await this.prisma.supportTicket.findFirst({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            userType: true,
            status: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    return ticket;
  }

  async updateSupportTicket(ticketId: string, data: {
    subject?: string;
    description?: string;
    category?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    assignedTo?: string;
  }, userId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { userId },
          { assignedTo: userId },
        ],
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado ou sem permissão');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    // Notificar sobre atualização
    await this.notificationsService.createNotification({
      userId: ticket.userId,
      type: 'REMINDER',
      title: 'Ticket Atualizado',
      message: `Seu ticket "${ticket.subject}" foi atualizado`,
      data: {
        ticketId: ticket.id,
        status: data.status,
        assignedTo: data.assignedTo,
      },
    });

    return updatedTicket;
  }

  async assignTicket(ticketId: string, assignedTo: string, _assignedBy: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    // Verificar se o usuário atribuído é um administrador
    const assignedUser = await this.prisma.user.findFirst({
      where: {
        id: assignedTo,
        userType: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    if (!assignedUser) {
      throw new BadRequestException('Usuário atribuído deve ser um administrador');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo,
        status: 'IN_PROGRESS',
      },
    });

    // Notificar usuário sobre atribuição
    await this.notificationsService.createNotification({
      userId: ticket.userId,
      type: 'REMINDER',
      title: 'Ticket Atribuído',
      message: `Seu ticket "${ticket.subject}" foi atribuído a um agente de suporte`,
      data: {
        ticketId: ticket.id,
        assignedTo,
      },
    });

    // Notificar agente atribuído
    await this.notificationsService.createNotification({
      userId: assignedTo,
      type: 'REMINDER',
      title: 'Novo Ticket Atribuído',
      message: `Você foi atribuído ao ticket "${ticket.subject}"`,
      data: {
        ticketId: ticket.id,
        priority: ticket.priority as TicketPriority,
        category: ticket.category as TicketCategory,
      },
    });

    return updatedTicket;
  }

  async resolveTicket(ticketId: string, resolvedBy: string, resolution: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket de suporte não encontrado');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Notificar usuário sobre resolução
    await this.notificationsService.createNotification({
      userId: ticket.userId,
      type: 'REMINDER',
      title: 'Ticket Resolvido',
      message: `Seu ticket "${ticket.subject}" foi resolvido`,
      data: {
        ticketId: ticket.id,
        resolution,
        resolvedBy,
      },
    });

    return updatedTicket;
  }

  async getTicketStatistics(userId?: string) {
    const where = userId ? { userId } : {};

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      ticketsByCategory,
      ticketsByPriority,
    ] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'CLOSED' } }),
      this.prisma.supportTicket.groupBy({
        by: ['category'],
        where,
        _count: { category: true },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
    ]);

    const averageResolutionTime = await this.calculateAverageResolutionTime(where);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
      averageResolutionTime,
      ticketsByCategory: ticketsByCategory.map(c => ({
        category: c.category,
        count: c._count.category,
      })),
      ticketsByPriority: ticketsByPriority.map(p => ({
        priority: p.priority,
        count: p._count.priority,
      })),
    };
  }

  async getAssignedTickets(assignedTo: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { assignedTo },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supportTicket.count({ where: { assignedTo } }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnassignedTickets(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: {
          assignedTo: null,
          status: 'OPEN',
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          assignedTo: null,
          status: 'OPEN',
        },
      }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchTickets(query: string, userId?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = {
      ...(userId && { userId }),
      OR: [
        { subject: { contains: query, mode: 'insensitive' as any } },
        { description: { contains: query, mode: 'insensitive' as any } },
        { category: { contains: query, mode: 'insensitive' as any } },
      ],
    };

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      query,
    };
  }

  async getSupportCategories() {
    return [
      {
        id: 'account',
        name: 'Conta e Cadastro',
        description: 'Problemas com conta, cadastro, validação',
        icon: 'user',
      },
      {
        id: 'wallet',
        name: 'Carteira Digital',
        description: 'Problemas com carteira, saldo, transferências',
        icon: 'wallet',
      },
      {
        id: 'transactions',
        name: 'Transações',
        description: 'Problemas com transferências, pagamentos',
        icon: 'credit-card',
      },
      {
        id: 'services',
        name: 'Pagamento de Serviços',
        description: 'Problemas com pagamento de contas',
        icon: 'file-text',
      },
      {
        id: 'smart-contracts',
        name: 'Smart Contracts',
        description: 'Problemas com contratos inteligentes',
        icon: 'shield',
      },
      {
        id: 'rateio',
        name: 'Rateio',
        description: 'Problemas com divisão de despesas',
        icon: 'users',
      },
      {
        id: 'rewards',
        name: 'Recompensas',
        description: 'Problemas com recompensas e gamificação',
        icon: 'gift',
      },
      {
        id: 'security',
        name: 'Segurança',
        description: 'Problemas de segurança, bloqueios',
        icon: 'lock',
      },
      {
        id: 'technical',
        name: 'Problemas Técnicos',
        description: 'Problemas com o aplicativo, bugs',
        icon: 'settings',
      },
      {
        id: 'other',
        name: 'Outros',
        description: 'Outros tipos de problemas',
        icon: 'help-circle',
      },
    ];
  }

  async getTicketStats(userId: string) {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      averageResolutionTime,
    ] = await Promise.all([
      this.prisma.supportTicket.count({
        where: { userId },
      }),
      this.prisma.supportTicket.count({
        where: { userId, status: 'OPEN' },
      }),
      this.prisma.supportTicket.count({
        where: { userId, status: 'IN_PROGRESS' },
      }),
      this.prisma.supportTicket.count({
        where: { userId, status: 'RESOLVED' },
      }),
      this.prisma.supportTicket.count({
        where: { userId, status: 'CLOSED' },
      }),
      this.prisma.supportTicket.count({
        where: { userId, priority: 'URGENT' },
      }),
      this.calculateAverageResolutionTime({ userId }),
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      averageResolutionTime,
      resolutionRate: totalTickets > 0 ? ((resolvedTickets + closedTickets) / totalTickets) * 100 : 0,
    };
  }

  async getOpenTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getUrgentTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { 
        userId, 
        OR: [
          { priority: 'URGENT' },
          { priority: 'HIGH' },
        ],
        status: { not: 'CLOSED' },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  private async notifyAdminsAboutNewTicket(ticket: any) {
    const admins = await this.prisma.user.findMany({
      where: {
        userType: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    for (const admin of admins) {
      await this.notificationsService.createNotification({
        userId: admin.id,
        type: 'REMINDER',
        title: 'Novo Ticket de Suporte',
        message: `Novo ticket criado: "${ticket.subject}"`,
        data: {
          ticketId: ticket.id,
          priority: ticket.priority as TicketPriority,
          category: ticket.category as TicketCategory,
          userId: ticket.userId,
        },
      });
    }
  }

  private async calculateAverageResolutionTime(where: any): Promise<number> {
    const resolvedTickets = await this.prisma.supportTicket.findMany({
      where: {
        ...where,
        status: 'RESOLVED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedTickets.length === 0) {
      return 0;
    }

    const totalTime = resolvedTickets.reduce((sum, ticket) => {
      const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return totalTime / resolvedTickets.length; // Tempo médio em milissegundos
  }
}
