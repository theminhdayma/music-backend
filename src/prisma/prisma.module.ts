import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { R2Service } from './r2.service';

@Global()
@Module({
  providers: [PrismaService, R2Service],
  exports: [PrismaService, R2Service],
})
export class PrismaModule {}
