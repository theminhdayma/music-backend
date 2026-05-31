import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LicensingModule } from './licensing.module';

@Module({
  imports: [PrismaModule, LicensingModule],
  providers: [PaymentService],
  controllers: [PaymentController],
})
export class StripeModule {}
