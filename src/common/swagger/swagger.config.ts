import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('PaySmart Premium API')
    .setDescription(`
      # PaySmart Premium - API de Carteira Digital Avançada

      ## Sobre
      API revolucionária para carteira digital avançada voltada para o mercado angolano.

      ## Funcionalidades Principais
      - ✅ **Validação Peer-to-Peer**: Sistema de validação entre usuários
      - ✅ **Pedidos de Pagamento com QR Code**: Geração automática de QR codes
      - ✅ **Carteiras Multi-moeda**: Suporte a AOA, USD, EUR
      - ✅ **Smart Contracts**: Transferências condicionais
      - ✅ **Rateio Direto**: Divisão automática de valores
      - ✅ **Notificações em Tempo Real**: Via Socket.io
      - ✅ **Sistema de Recompensas**: Gamificação integrada
      - ✅ **Analytics Avançados**: Relatórios e métricas
      - ✅ **Detecção de Fraudes**: Segurança inteligente

      ## Autenticação
      A API utiliza JWT (JSON Web Tokens) para autenticação. Inclua o token no header:
      \`\`\`
      Authorization: Bearer <seu-token-jwt>
      \`\`\`

      ## WebSocket
      Para notificações em tempo real, conecte-se via Socket.io:
      \`\`\`
      socket://localhost:3000/notifications
      \`\`\`

      ## Rate Limiting
      - Geral: 100 requests por 15 minutos
      - Autenticação: 5 tentativas por minuto

      ## Códigos de Status
      - 200: Sucesso
      - 201: Criado
      - 400: Dados inválidos
      - 401: Não autorizado
      - 403: Proibido
      - 404: Não encontrado
      - 429: Muitas requisições
      - 500: Erro interno
    `)
    .setVersion('1.0.0')
    .addTag('auth', 'Autenticação e autorização')
    .addTag('users', 'Gestão de usuários e validação peer-to-peer')
    .addTag('wallets', 'Gestão de carteiras multi-moeda')
    .addTag('transactions', 'Transações e pagamentos')
    .addTag('payment-requests', 'Pedidos de pagamento com QR Code')
    .addTag('services', 'Pagamentos de serviços')
    .addTag('notifications', 'Sistema de notificações em tempo real')
    .addTag('rewards', 'Sistema de recompensas e gamificação')
    .addTag('analytics', 'Analytics e relatórios')
    .addTag('security', 'Segurança e detecção de fraudes')
    .addTag('support', 'Suporte ao cliente')
    .addTag('shared-wallets', 'Carteiras compartilhadas')
    .addTag('smart-contracts', 'Operações tipo Smart Contract')
    .addTag('rateio', 'Transferências com Rateio Direto')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Servidor de Desenvolvimento')
    .addServer('https://api.paysmart.ao', 'Servidor de Produção')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    customSiteTitle: 'PaySmart Premium API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; font-size: 36px; }
      .swagger-ui .info .description { font-size: 16px; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 8px; }
    `,
  });
} 