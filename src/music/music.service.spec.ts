/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MusicService } from './music.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

describe('MusicService', () => {
  let service: MusicService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicService,
        {
          provide: PrismaService,
          useValue: {
            song: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MusicService>(MusicService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a song if found', async () => {
      const mockSong = { id: 'song-uuid', title: 'Song 1' };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);

      const result = await service.findOne('song-uuid');
      expect(result).toEqual(mockSong);
    });

    it('should throw NotFoundException if song not found', async () => {
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update song successfully if user is owner', async () => {
      const mockSong = {
        id: 'song-uuid',
        ownerId: 'owner-uuid',
        title: 'Original',
      };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);
      (prisma.song.update as jest.Mock).mockResolvedValue({
        ...mockSong,
        title: 'Updated',
      });

      const result = await service.update('song-uuid', 'owner-uuid', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const mockSong = { id: 'song-uuid', ownerId: 'owner-uuid' };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);

      await expect(
        service.update('song-uuid', 'stranger-uuid', { title: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should block deletion if song has active licenses', async () => {
      const mockSong = {
        id: 'song-uuid',
        ownerId: 'owner-uuid',
        userLicenses: [{ id: 'license-1' }], // has active license
      };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);

      await expect(service.remove('song-uuid', 'owner-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete song if no active licenses and user is owner', async () => {
      const mockSong = {
        id: 'song-uuid',
        ownerId: 'owner-uuid',
        userLicenses: [], // no active licenses
      };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);
      (prisma.song.delete as jest.Mock).mockResolvedValue({ id: 'song-uuid' });

      const result = await service.remove('song-uuid', 'owner-uuid');
      expect(result).toBeDefined();
      expect(prisma.song.delete).toHaveBeenCalledWith({
        where: { id: 'song-uuid' },
      });
    });
  });
});
