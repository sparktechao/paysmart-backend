import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SmartContractsController } from './smart-contracts.controller';
import { SmartContractsService } from './smart-contracts.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    PrismaModule, 
    NotificationsModule, 
    TransactionsModule,
    BullModule.registerQueue({
      name: 'smart-contract-queue',
    }),
  ],
  controllers: [SmartContractsController],
  providers: [SmartContractsService],
  exports: [SmartContractsService],
})
export class SmartContractsModule {}
