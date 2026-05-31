import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { RoyaltyService } from './royalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('royalty')
@UseGuards(JwtAuthGuard)
export class RoyaltyController {
  constructor(private royaltyService: RoyaltyService) {}

  @Get('wallet')
  async getWallet(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.royaltyService.getWallet(userId);
  }

  @Get('transactions')
  async getTransactions(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.royaltyService.getTransactions(userId);
  }
}
