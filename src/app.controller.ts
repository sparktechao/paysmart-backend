import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from './common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@ApiTags('system')
@Controller()
export class AppController {
  private redisClient: RedisClientType | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Inicializar cliente Redis se disponível
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        this.redisClient = createClient({ url: redisUrl });
        await this.redisClient.connect();
      }
    } catch (error) {
      // Redis não disponível, continuar sem ele
      this.redisClient = null;
    }
  }

  private async checkDatabase(): Promise<{ status: string; responseTime?: number }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      return { status: 'connected', responseTime };
    } catch (error) {
      return { status: 'disconnected' };
    }
  }

  private async checkCache(): Promise<{ status: string; responseTime?: number }> {
    if (!this.redisClient) {
      return { status: 'not_configured' };
    }

    try {
      const start = Date.now();
      await this.redisClient.ping();
      const responseTime = Date.now() - start;
      return { status: 'connected', responseTime };
    } catch (error) {
      return { status: 'disconnected' };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Informações da API' })
  @ApiResponse({ status: 200, description: 'Informações da API PaySmart Premium' })
  async getInfo() {
    const [databaseStatus, cacheStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    return {
      name: 'PaySmart Premium API',
      version: '1.0.0',
      description: 'API revolucionária para carteira digital avançada do mercado angolano',
      features: [
        'Validação Peer-to-Peer',
        'Pedidos de Pagamento com QR Code',
        'Carteiras Multi-moeda e Compartilhadas',
        'Múltiplos Tipos de Conta (PERSONAL, BUSINESS, MERCHANT)',
        'Gamificação e Analytics',
        'Operações Tipo Smart Contract',
        'Transferências com Rateio Direto',
        'Sistema de Notificações em Tempo Real',
        'Detecção de Fraudes',
      ],
      services: {
        database: databaseStatus.status,
        cache: cacheStatus.status,
      },
      documentation: '/api-docs',
      websocket: '/notifications',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        wallets: '/api/v1/wallets',
        transactions: '/api/v1/transactions',
        paymentRequests: '/api/v1/payment-requests',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check da aplicação' })
  @ApiResponse({ status: 200, description: 'Aplicação saudável' })
  @ApiResponse({ status: 503, description: 'Aplicação com problemas' })
  async getHealth() {
    const [databaseStatus, cacheStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const isDatabaseOk = databaseStatus.status === 'connected';
    const isCacheOk = cacheStatus.status === 'connected' || cacheStatus.status === 'not_configured';
    
    const overallStatus = isDatabaseOk && isCacheOk ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: {
          status: databaseStatus.status,
          responseTime: databaseStatus.responseTime,
        },
        cache: {
          status: cacheStatus.status,
          responseTime: cacheStatus.responseTime,
        },
      },
    };
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ping da aplicação' })
  @ApiResponse({ status: 200, description: 'Pong' })
  getPing() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}
