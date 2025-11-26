import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { QueueModule } from './common/queue/queue.module';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './common/auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';
import { ServicesModule } from './services/services.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RewardsModule } from './rewards/rewards.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SecurityModule } from './security/security.module';
import { SupportModule } from './support/support.module';
import { SharedWalletsModule } from './shared-wallets/shared-wallets.module';
import { SmartContractsModule } from './smart-contracts/smart-contracts.module';
import { RateioModule } from './rateio/rateio.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60000,
        limit: 100,
      }]
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    WalletsModule,
    TransactionsModule,
    PaymentRequestsModule,
    ServicesModule,
    NotificationsModule,
    RewardsModule,
    AnalyticsModule,
    SecurityModule,
    SupportModule,
    SharedWalletsModule,
    SmartContractsModule,
    RateioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
