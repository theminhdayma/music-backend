import { Module } from '@nestjs/common';
import { LicensingController } from './licensing.controller';
import { LicensingService } from './licensing.service';
import { RoyaltyService } from './royalty.service';
import { RoyaltyController } from './royalty.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LicensingController, RoyaltyController],
  providers: [LicensingService, RoyaltyService],
  exports: [LicensingService, RoyaltyService],
})
export class LicensingModule {}
