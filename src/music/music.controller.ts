import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MusicService } from './music.service';
import { UpdateSongDto } from './dto/update-song.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('music/songs')
export class MusicController {
  constructor(private musicService: MusicService) {}

  @Get()
  async findAll(
    @Query('genre') genre?: string,
    @Query('ownerId') ownerId?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    const publishedFilter =
      isPublished === 'true'
        ? true
        : isPublished === 'false'
          ? false
          : undefined;
    return this.musicService.findAll({
      genre,
      ownerId,
      isPublished: publishedFilter,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.musicService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSongDto,
  ) {
    const ownerId = req.user.id;
    return this.musicService.update(id, ownerId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const ownerId = req.user.id;
    return this.musicService.remove(id, ownerId);
  }
}
