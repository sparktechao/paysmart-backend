import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger/swagger.config';
import { corsOptions } from './common/cors/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configurações de segurança
  app.use(helmet());
  app.use(compression());
  
  // CORS
  app.enableCors(corsOptions);

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Temporariamente desabilitado para teste
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // Configuração do Swagger
  setupSwagger(app);

  const port = configService.get('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 PaySmart Premium API rodando na porta ${port}`);
  console.log(`📚 Documentação disponível em: http://localhost:${port}/api-docs`);
  console.log(`🔌 WebSocket disponível em: ws://localhost:${port}/notifications`);
}

bootstrap();
