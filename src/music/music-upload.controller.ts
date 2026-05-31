import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { MusicUploadService } from './music-upload.service';
import { InitUploadDto } from './dto/init-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('music/upload')
@UseGuards(JwtAuthGuard)
export class MusicUploadController {
  constructor(private musicUploadService: MusicUploadService) {}

  @Post('init')
  async initialize(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitUploadDto,
  ) {
    const ownerId = req.user.id;
    return this.musicUploadService.initializeUpload(ownerId, dto);
  }

  @Get(':sessionId/url')
  async getUrl(
    @Param('sessionId') sessionId: string,
    @Query('partNumber', ParseIntPipe) partNumber: number,
  ) {
    return this.musicUploadService.getPresignedUrl(sessionId, partNumber);
  }

  @Post(':sessionId/complete')
  async complete(
    @Param('sessionId') sessionId: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.musicUploadService.completeUpload(sessionId, dto);
  }
}
