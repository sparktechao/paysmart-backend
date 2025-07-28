import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Service, ServiceType, Currency } from '@prisma/client';
import { ServicePaymentResponseDto } from './dto/services.dto';

@Injectable()
export class ServicesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private transactionsService: TransactionsService,
  ) {}

  async payService(data: {
    userId: string;
    fromWalletId: string;
    serviceType: ServiceType;
    provider: string;
    accountNumber: string;
    amount: number;
    currency: Currency;
    description?: string;
  }): Promise<ServicePaymentResponseDto> {
    // Verificar se a carteira existe e tem saldo suficiente
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: data.fromWalletId,
        userId: data.userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    const currentBalance = (wallet.balances as any)[data.currency] || 0;
    if (currentBalance < data.amount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    // Validar dados do serviço
    this.validateServiceData(data);

    // Criar registro do serviço
    const service = await this.prisma.service.create({
      data: {
        name: `${data.serviceType} - ${data.provider}`,
        type: data.serviceType,
        provider: data.provider,
        accountNumber: data.accountNumber,
        amount: data.amount,
        currency: data.currency,
        status: 'PENDING',
      },
    });

    try {
      // Processar pagamento (simulado - em produção seria integração real)
      const paymentResult = await this.processServicePayment(service);

      if (paymentResult.success) {
        // Atualizar status do serviço
        await this.prisma.service.update({
          where: { id: service.id },
          data: {
            status: 'COMPLETED',
            receipt: paymentResult.receiptUrl,
          },
        });

        // Deduzir saldo da carteira
        await this.updateWalletBalance(data.fromWalletId, data.amount, data.currency);

        // Criar transação
        const transaction = await this.transactionsService.createTransaction({
          fromWalletId: data.fromWalletId,
          toWalletId: data.fromWalletId, // Auto-transação para serviços
          fromUserId: data.userId,
          toUserId: data.userId,
          type: 'SERVICE_PAYMENT',
          amount: data.amount,
          currency: data.currency,
          description: data.description || `Pagamento ${data.serviceType} - ${data.provider}`,
          notes: `Conta: ${data.accountNumber}`,
        });

        // Notificar usuário
        await this.notificationsService.createNotification({
          userId: data.userId,
          type: 'PAYMENT_SENT',
          title: 'Pagamento de Serviço Realizado',
          message: `Pagamento de ${data.amount} ${data.currency} para ${data.provider} realizado com sucesso`,
          data: {
            serviceId: service.id,
            transactionId: transaction.id,
            receiptUrl: paymentResult.receiptUrl,
          },
        });

        return {
          id: service.id,
          walletId: data.fromWalletId,
          userId: data.userId,
          serviceType: data.serviceType as any,
          provider: data.provider,
          accountNumber: data.accountNumber,
          amount: data.amount,
          currency: data.currency as any,
          status: 'COMPLETED' as any,
          receiptUrl: paymentResult.receiptUrl,
          transactionId: transaction.id,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
        };
      } else {
        throw new BadRequestException(paymentResult.error || 'Erro ao processar pagamento');
      }
    } catch (error) {
      // Atualizar status para falhado
      await this.prisma.service.update({
        where: { id: service.id },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  async getServiceHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Buscar transações de serviços do usuário
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          fromUserId: userId,
          type: 'SERVICE_PAYMENT',
        },
        include: {
          fromWallet: {
            select: {
              walletNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          fromUserId: userId,
          type: 'SERVICE_PAYMENT',
        },
      }),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getServicePaymentById(serviceId: string, userId: string): Promise<ServicePaymentResponseDto> {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return {
      id: service.id,
      walletId: '', // TODO: Implement proper wallet mapping
      userId,
      serviceType: service.type as any,
      provider: service.provider,
      accountNumber: service.accountNumber,
      amount: service.amount,
      currency: service.currency as any,
      status: service.status as any,
      receiptUrl: service.receipt || '',
      transactionId: '', // TODO: Implement proper transaction mapping
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  async getServiceDetails(serviceId: string, userId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    // Buscar transação relacionada
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        description: {
          contains: service.name,
        },
        fromUserId: userId,
        type: 'SERVICE_PAYMENT',
      },
    });

    return {
      service,
      transaction,
    };
  }

  async getAvailableServices() {
    return [
      {
        type: 'UNITEL' as any,
        name: 'Unitel',
        description: 'Recarga de telefone Unitel',
        isAvailable: true,
        minAmount: 50,
        maxAmount: 50000,
        fee: 0,
        processingTime: '5 minutes',
      },
      {
        type: 'MOVICEL' as any,
        name: 'Movicel',
        description: 'Recarga de telefone Movicel',
        isAvailable: true,
        minAmount: 50,
        maxAmount: 50000,
        fee: 0,
        processingTime: '5 minutes',
      },
      {
        type: 'ZAP' as any,
        name: 'ZAP',
        description: 'Pagamento de serviços ZAP',
        isAvailable: true,
        minAmount: 100,
        maxAmount: 100000,
        fee: 0,
        processingTime: '10 minutes',
      },
      {
        type: 'TV_CABO' as any,
        name: 'TV Cabo',
        description: 'Pagamento de TV Cabo',
        isAvailable: true,
        minAmount: 1000,
        maxAmount: 50000,
        fee: 0,
        processingTime: '15 minutes',
      },
      {
        type: 'ELECTRICITY' as any,
        name: 'Energia Elétrica',
        description: 'Pagamento de conta de energia',
        isAvailable: true,
        minAmount: 500,
        maxAmount: 100000,
        fee: 0,
        processingTime: '30 minutes',
      },
      {
        type: 'WATER' as any,
        name: 'Água',
        description: 'Pagamento de conta de água',
        isAvailable: true,
        minAmount: 200,
        maxAmount: 50000,
        fee: 0,
        processingTime: '30 minutes',
      },
      {
        type: 'INTERNET' as any,
        name: 'Internet',
        description: 'Pagamento de serviços de internet',
        isAvailable: true,
        minAmount: 1000,
        maxAmount: 100000,
        fee: 0,
        processingTime: '15 minutes',
      },
      {
        type: 'OTHER' as any,
        name: 'Outros Serviços',
        description: 'Outros serviços disponíveis',
        isAvailable: true,
        minAmount: 100,
        maxAmount: 1000000,
        fee: 0,
        processingTime: '30 minutes',
      },
    ];
  }

  async validateAccount(validateAccountDto: any) {
    const { serviceType, accountNumber } = validateAccountDto;
    
    try {
      const accountInfo = await this.getAccountInfo(serviceType, accountNumber);
      
      return {
        isValid: true,
        accountNumber,
        accountName: accountInfo.accountName,
        balance: accountInfo.balance,
        dueDate: new Date(),
        errorMessage: undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        accountNumber,
        accountName: undefined,
        balance: undefined,
        dueDate: undefined,
        errorMessage: 'Conta inválida ou não encontrada',
      };
    }
  }

  async validateAccountNumber(serviceType: ServiceType, accountNumber: string) {
    // Simular validação de número de conta
    // Em produção, isso seria uma integração real com os provedores
    
    const validations = {
      UNITEL: /^9\d{8}$/,
      MOVICEL: /^9\d{8}$/,
      ZAP: /^[A-Z0-9]{6,12}$/,
      TV_CABO: /^[A-Z0-9]{8,15}$/,
      ELECTRICITY: /^[A-Z0-9]{10,20}$/,
      WATER: /^[A-Z0-9]{8,15}$/,
      INTERNET: /^[A-Z0-9]{6,12}$/,
      OTHER: /^.+$/,
    };

    const regex = validations[serviceType];
    if (!regex) {
      throw new BadRequestException('Tipo de serviço não suportado');
    }

    const isValid = regex.test(accountNumber);
    
    if (!isValid) {
      throw new BadRequestException(`Número de conta inválido para ${serviceType}`);
    }

    // Simular busca de informações da conta
    const accountInfo = await this.getAccountInfo(serviceType, accountNumber);

    return {
      isValid: true,
      accountInfo,
    };
  }

  async getServiceStatistics(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        fromUserId: userId,
        type: 'SERVICE_PAYMENT',
        createdAt: {
          gte: startDate,
        },
      },
    });

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const serviceCount = transactions.length;

    // Agrupar por tipo de serviço
    const serviceTypes = transactions.reduce((acc, t) => {
      const serviceType = this.extractServiceType(t.description);
      acc[serviceType] = (acc[serviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      period,
      totalAmount,
      serviceCount,
      serviceTypes,
      transactions: transactions.slice(0, 10), // Últimas 10 transações
    };
  }

  async getServiceTypes() {
    return [
      { type: 'ELECTRICITY', name: 'Energia Elétrica', providers: ['EDP', 'Endesa', 'Iberdrola'] },
      { type: 'WATER', name: 'Água', providers: ['Águas de Portugal', 'SMAS'] },
      { type: 'GAS', name: 'Gás', providers: ['Galp', 'EDP', 'Endesa'] },
      { type: 'INTERNET', name: 'Internet', providers: ['NOS', 'Vodafone', 'MEO', 'Nowo'] },
      { type: 'MOBILE', name: 'Telemóvel', providers: ['NOS', 'Vodafone', 'MEO'] },
      { type: 'TV', name: 'Televisão', providers: ['NOS', 'Vodafone', 'MEO', 'Nowo'] },
      { type: 'INSURANCE', name: 'Seguros', providers: ['Allianz', 'Fidelidade', 'Tranquilidade'] },
      { type: 'CREDIT_CARD', name: 'Cartão de Crédito', providers: ['Santander', 'Millennium', 'Caixa'] },
      { type: 'LOAN', name: 'Empréstimo', providers: ['Santander', 'Millennium', 'Caixa'] },
      { type: 'TAX', name: 'Impostos', providers: ['AT', 'Câmara Municipal'] },
    ];
  }

  async getServiceFees() {
    return [
      { serviceType: 'ELECTRICITY', fee: 0.50, percentage: 0.5 },
      { serviceType: 'WATER', fee: 0.30, percentage: 0.3 },
      { serviceType: 'GAS', fee: 0.40, percentage: 0.4 },
      { serviceType: 'INTERNET', fee: 1.00, percentage: 1.0 },
      { serviceType: 'MOBILE', fee: 0.75, percentage: 0.75 },
      { serviceType: 'TV', fee: 0.80, percentage: 0.8 },
      { serviceType: 'INSURANCE', fee: 2.00, percentage: 2.0 },
      { serviceType: 'CREDIT_CARD', fee: 1.50, percentage: 1.5 },
      { serviceType: 'LOAN', fee: 3.00, percentage: 3.0 },
      { serviceType: 'TAX', fee: 0.25, percentage: 0.25 },
    ];
  }

  async payMultipleServices(data: {
    userId: string;
    fromWalletId: string;
    services: Array<{
      serviceType: ServiceType;
      provider: string;
      accountNumber: string;
      amount: number;
      currency: Currency;
      description?: string;
    }>;
  }): Promise<ServicePaymentResponseDto[]> {
    const results = [];
    const errors = [];

    for (const serviceData of data.services) {
      try {
        const result = await this.payService({
          userId: data.userId,
          fromWalletId: data.fromWalletId,
          ...serviceData,
        });
        results.push(result);
      } catch (error) {
        errors.push({
          service: serviceData,
          error: (error as any).message || 'Erro desconhecido',
        });
      }
    }

    return results;
  }

  async getServiceStats(_userId: string) {
    const totalServices = await this.prisma.service.count();

    const completedServices = await this.prisma.service.count({
      where: { status: 'COMPLETED' },
    });

    const pendingServices = await this.prisma.service.count({
      where: { status: 'PENDING' },
    });

    const totalAmount = await this.prisma.service.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const servicesByType = await this.prisma.service.groupBy({
      by: ['type'],
      _count: { type: true },
      _sum: { amount: true },
    });

    const recentServices = await this.prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      totalServices,
      completedServices,
      pendingServices,
      totalAmount: totalAmount._sum.amount || 0,
      successRate: totalServices > 0 ? (completedServices / totalServices) * 100 : 0,
      servicesByType,
      recentServices,
    };
  }

  private validateServiceData(data: any) {
    if (!data.accountNumber || data.accountNumber.trim().length === 0) {
      throw new BadRequestException('Número da conta é obrigatório');
    }

    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    if (!data.provider || data.provider.trim().length === 0) {
      throw new BadRequestException('Provedor é obrigatório');
    }

    // Validar limites por tipo de serviço
    const limits = this.getServiceLimits(data.serviceType);
    if (data.amount < limits.minAmount || data.amount > limits.maxAmount) {
      throw new BadRequestException(
        `Valor deve estar entre ${limits.minAmount} e ${limits.maxAmount} ${data.currency}`
      );
    }
  }

  private getServiceLimits(serviceType: ServiceType) {
    const limits = {
      UNITEL: { minAmount: 50, maxAmount: 50000 },
      MOVICEL: { minAmount: 50, maxAmount: 50000 },
      ZAP: { minAmount: 100, maxAmount: 100000 },
      TV_CABO: { minAmount: 1000, maxAmount: 50000 },
      ELECTRICITY: { minAmount: 500, maxAmount: 100000 },
      WATER: { minAmount: 200, maxAmount: 50000 },
      INTERNET: { minAmount: 1000, maxAmount: 100000 },
      OTHER: { minAmount: 100, maxAmount: 1000000 },
    };

    return limits[serviceType] || limits.OTHER;
  }

  private async processServicePayment(service: Service) {
    // Simular processamento de pagamento
    // Em produção, isso seria uma integração real com os provedores
    
    try {
      // Simular delay de processamento
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simular sucesso (90% das vezes)
      const success = Math.random() > 0.1;

      if (success) {
        return {
          success: true,
          receiptUrl: `https://receipts.paysmart.ao/${service.id}.pdf`,
          transactionId: `TXN${Date.now()}`,
        };
      } else {
        return {
          success: false,
          error: 'Serviço temporariamente indisponível',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Erro interno do servidor',
      };
    }
  }

  private async updateWalletBalance(walletId: string, amount: number, currency: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { balances: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    const currentBalance = (wallet.balances as any)[currency] || 0;
    const newBalance = currentBalance - amount;

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
                  balances: {
            ...(wallet.balances as any),
            [currency]: newBalance,
          },
      },
    });
  }

  private async getAccountInfo(serviceType: ServiceType, _accountNumber: string) {
    // Simular busca de informações da conta
    // Em produção, isso seria uma integração real
    
    const mockInfo = {
      UNITEL: {
        accountName: 'João Silva',
        balance: Math.floor(Math.random() * 1000),
        plan: 'Plano Básico',
      },
      MOVICEL: {
        accountName: 'Maria Santos',
        balance: Math.floor(Math.random() * 1000),
        plan: 'Plano Premium',
      },
      ZAP: {
        accountName: 'Carlos Oliveira',
        balance: Math.floor(Math.random() * 5000),
        plan: 'Pacote Completo',
      },
      TV_CABO: {
        accountName: 'Ana Costa',
        balance: Math.floor(Math.random() * 10000),
        plan: 'Pacote Família',
      },
      ELECTRICITY: {
        accountName: 'Pedro Lima',
        balance: Math.floor(Math.random() * 50000),
        plan: 'Residencial',
      },
      WATER: {
        accountName: 'Lucia Ferreira',
        balance: Math.floor(Math.random() * 20000),
        plan: 'Residencial',
      },
      INTERNET: {
        accountName: 'Roberto Alves',
        balance: Math.floor(Math.random() * 15000),
        plan: 'Fibra 100MB',
      },
      OTHER: {
        accountName: 'Conta Genérica',
        balance: 0,
        plan: 'N/A',
      },
    };

    return mockInfo[serviceType] || mockInfo.OTHER;
  }

  private extractServiceType(description: string): string {
    const serviceTypes = ['UNITEL', 'MOVICEL', 'ZAP', 'TV_CABO', 'ELECTRICITY', 'WATER', 'INTERNET'];
    
    for (const type of serviceTypes) {
      if (description.toUpperCase().includes(type)) {
        return type;
      }
    }
    
    return 'OTHER';
  }
}
