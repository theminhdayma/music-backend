import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../prisma/r2.service';
import { UpdateSongDto } from './dto/update-song.dto';

@Injectable()
export class MusicService {
  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
  ) {}

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

  async getPlaybackStream(id: string, stemId?: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        stems: {
          select: {
            id: true,
            type: true,
            fileUrl: true,
          },
        },
      },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${id} not found`);
    }

    const selectedStem = stemId
      ? song.stems.find((stem) => stem.id === stemId)
      : null;

    if (stemId && !selectedStem) {
      throw new NotFoundException(
        `Stem with ID ${stemId} not found for song ${id}`,
      );
    }

    const fileUrl = selectedStem?.fileUrl || song.fileUrl;

    const response = await this.r2Service.getS3Client().send(
      new GetObjectCommand({
        Bucket: this.r2Service.getBucketName(),
        Key: fileUrl,
      }),
    );

    if (!response.Body) {
      throw new BadRequestException('Audio playback stream is unavailable');
    }

    return {
      stream: response.Body,
      contentType: response.ContentType || this.getContentType(fileUrl),
      filename: selectedStem?.type || song.title,
    };
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

  private getContentType(fileUrl: string): string {
    const ext = fileUrl.split('.').pop()?.toLowerCase();
    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'flac') return 'audio/flac';
    return 'application/octet-stream';
  }
}
