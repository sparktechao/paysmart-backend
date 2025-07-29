import { Module } from '@nestjs/common';
import { ValidationsController } from './validations.controller';
import { ValidationsService } from './validations.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}