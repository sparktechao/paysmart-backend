import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('system')
@Controller()
export class AppController {
  constructor() {}

  @Get()
  @ApiOperation({ summary: 'Informações da API' })
  @ApiResponse({ status: 200, description: 'Informações da API PaySmart Premium' })
  getInfo() {
    return {
      name: 'PaySmart Premium API',
      version: '1.0.0',
      description: 'API revolucionária para carteira digital avançada do mercado angolano',
      features: [
        'Validação Peer-to-Peer',
        'Pedidos de Pagamento com QR Code',
        'Carteiras Multi-moeda e Compartilhadas',
        'Gamificação e Analytics',
        'Operações Tipo Smart Contract',
        'Transferências com Rateio Direto',
        'Sistema de Notificações em Tempo Real',
        'Detecção de Fraudes',
      ],
      documentation: '/api-docs',
      websocket: '/notifications',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check da aplicação' })
  @ApiResponse({ status: 200, description: 'Aplicação saudável' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
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
