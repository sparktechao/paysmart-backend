import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Priorizar BULL_REDIS_URL, depois REDIS_URL
        const redisUrl = configService.get<string>('BULL_REDIS_URL') || 
                         configService.get<string>('REDIS_URL');
        
        if (redisUrl) {
          try {
            // Parse da URL do Redis (ex: redis://cache:6379 ou redis://user:pass@host:port/db)
            const url = new URL(redisUrl);
            return {
              redis: {
                host: url.hostname,  // 'cache' no Docker, 'localhost' localmente
                port: parseInt(url.port) || 6379,
                password: url.password || undefined,
                db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
              },
              defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
              },
            };
          } catch (error) {
            // Se falhar o parse, usar configuração manual como fallback
            console.warn('Erro ao fazer parse da REDIS_URL, usando configuração manual', error);
          }
        }
        
        // Fallback para configuração manual (compatibilidade com variáveis antigas)
        return {
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
          },
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: 'validation-queue',
      },
      {
        name: 'premium-upgrade-queue',
      },
      {
        name: 'notification-queue',
      },
      {
        name: 'smart-contract-queue',
      },
      {
        name: 'rateio-queue',
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {} 