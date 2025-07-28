import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    WalletsModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'smart-contract-queue',
    }),
    BullModule.registerQueue({
      name: 'rateio-queue',
    }),
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {} 