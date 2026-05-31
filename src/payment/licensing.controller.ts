import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LicensingService } from './licensing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('licenses')
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyLicenses(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId || req.user.id;
    return this.licensingService.findMyLicenses(userId);
  }

  @Get('songs/:songId/options')
  async getOptions(@Param('songId') songId: string) {
    return this.licensingService.getLicenseOptions(songId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('songs/:songId/config')
  async updateConfig(
    @Param('songId') songId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: Prisma.SongLicenseConfigUpdateInput,
  ) {
    const ownerId = req.user.userId || req.user.id;
    return this.licensingService.updateLicenseConfig(songId, ownerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase-free')
  async purchaseFree(
    @Body('songId') songId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.licensingService.purchaseFreeLicense(songId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate/:songId')
  async validate(
    @Param('songId') songId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId || req.user.id;
    const isValid = await this.licensingService.validateLicense(songId, userId);
    return { isValid };
  }
}
