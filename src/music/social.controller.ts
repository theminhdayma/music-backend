import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('music/songs')
export class SocialController {
  constructor(private socialService: SocialService) {}

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async toggleLike(
    @Param('id') songId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.socialService.toggleLike(songId, userId);
  }

  @Get(':id/like-status')
  async getLikeStatus(
    @Param('id') songId: string,
    @Query('userId') userId?: string,
  ) {
    return this.socialService.getLikeStatus(songId, userId);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @Param('id') songId: string,
    @Req() req: AuthenticatedRequest,
    @Body('content') content: string,
  ) {
    const userId = req.user.id;
    return this.socialService.createComment(songId, userId, content);
  }

  @Get(':id/comments')
  async getComments(@Param('id') songId: string) {
    return this.socialService.getComments(songId);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Param('commentId') commentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.socialService.deleteComment(commentId, userId);
  }
}
