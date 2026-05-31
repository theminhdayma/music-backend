import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSongDto } from './dto/update-song.dto';

@Injectable()
export class MusicService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    genre?: string;
    ownerId?: string;
    isPublished?: boolean;
  }) {
    const where: Prisma.SongWhereInput = {};
    if (filters.genre) where.genre = filters.genre;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.isPublished !== undefined)
      where.isPublished = filters.isPublished;

    return this.prisma.song.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        stems: true,
        analysis: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        stems: true,
        analysis: true,
      },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${id} not found`);
    }

    return song;
  }

  async update(id: string, ownerId: string, dto: UpdateSongDto) {
    const song = await this.findOne(id);

    if (song.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to update this song',
      );
    }

    return this.prisma.song.update({
      where: { id },
      data: {
        title: dto.title,
        genre: dto.genre,
        bpm: dto.bpm,
        key: dto.key,
        mood: dto.mood,
        tags: dto.tags,
        lyrics: dto.lyrics,
        instruments: dto.instruments,
        vocalType: dto.vocalType,
        licenseType: dto.licenseType,
        remixAllowed: dto.remixAllowed,
        commercialAllowed: dto.commercialAllowed,
        aiVoiceCloningAllowed: dto.aiVoiceCloningAllowed,
        royaltySplitRemixer: dto.royaltySplitRemixer,
        royaltySplitPlatform: dto.royaltySplitPlatform,
        isPublished: dto.isPublished,
      },
    });
  }

  async remove(id: string, ownerId: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        userLicenses: true,
      },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${id} not found`);
    }

    if (song.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to delete this song',
      );
    }

    // Edge Case: Block deletion if song has active user licenses purchased
    if (song.userLicenses && song.userLicenses.length > 0) {
      throw new BadRequestException(
        'Cannot delete song with active purchased licenses',
      );
    }

    return this.prisma.song.delete({
      where: { id },
    });
  }
}
