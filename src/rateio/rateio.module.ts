import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RateioController } from './rateio.controller';
import { RateioService } from './rateio.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    PrismaModule, 
    NotificationsModule, 
    TransactionsModule,
    BullModule.registerQueue({
      name: 'rateio-queue',
    }),
  ],
  controllers: [RateioController],
  providers: [RateioService],
  exports: [RateioService],
})
export class RateioModule {}
