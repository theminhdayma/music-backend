import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LicensingService {
  constructor(private prisma: PrismaService) {}

  async findMyLicenses(userId: string) {
    return this.prisma.userLicense.findMany({
      where: { userId },
      include: { song: true },
    });
  }

  async getLicenseOptions(songId: string) {
    const config = await this.prisma.songLicenseConfig.findUnique({
      where: { songId },
    });
    if (!config) {
      throw new NotFoundException(
        `License configuration for song ${songId} not found`,
      );
    }
    return config;
  }

  async updateLicenseConfig(
    songId: string,
    ownerId: string,
    dto: Prisma.SongLicenseConfigUpdateInput,
  ) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }
    if (song.ownerId !== ownerId) {
      throw new ForbiddenException(
        `You do not have permission to update this song's license config`,
      );
    }

    return this.prisma.songLicenseConfig.update({
      where: { songId },
      data: dto,
    });
  }

  async purchaseFreeLicense(songId: string, userId: string) {
    const config = await this.getLicenseOptions(songId);

    if (!config.personalEnabled) {
      throw new BadRequestException(
        'Personal license is not enabled for this song',
      );
    }
    if (config.personalPrice > 0) {
      throw new BadRequestException(
        'Personal license for this song is not free. Use payment gateway instead.',
      );
    }

    const existing = await this.prisma.userLicense.findFirst({
      where: { userId, songId, licenseType: 'personal' },
    });
    if (existing) {
      throw new BadRequestException(
        'You already own a Personal license for this song',
      );
    }

    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    const shortSong = songId.substring(0, 4).toUpperCase();
    const licenseKey = `STMV-${shortSong}-PERS-${randomStr}`;

    return this.prisma.userLicense.create({
      data: {
        userId,
        songId,
        licenseType: 'personal',
        pricePaid: 0,
        currency: 'USD',
        licenseKey,
      },
    });
  }

  async validateLicense(songId: string, userId: string): Promise<boolean> {
    const license = await this.prisma.userLicense.findFirst({
      where: { userId, songId },
    });
    return !!license;
  }
}
