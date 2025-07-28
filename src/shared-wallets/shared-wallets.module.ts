import { Module } from '@nestjs/common';
import { SharedWalletsController } from './shared-wallets.controller';
import { SharedWalletsService } from './shared-wallets.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [PrismaModule, NotificationsModule, TransactionsModule],
  controllers: [SharedWalletsController],
  providers: [SharedWalletsService],
  exports: [SharedWalletsService],
})
export class SharedWalletsModule {}
