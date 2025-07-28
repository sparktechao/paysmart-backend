import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    TransactionsModule,
    BullModule.registerQueue({
      name: 'validation-queue',
    }),
    BullModule.registerQueue({
      name: 'premium-upgrade-queue',
    }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {} 