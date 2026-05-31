/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { SocialService } from './social.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('SocialService', () => {
  let service: SocialService;
  let prisma: PrismaService;

  const mockPrismaService = {
    song: {
      findUnique: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('toggleLike', () => {
    it('should throw NotFoundException if song does not exist', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue(null);
      await expect(
        service.toggleLike('invalid-song', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a like if it does not exist', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue({ id: 'song-1' });
      mockPrismaService.like.findUnique.mockResolvedValue(null);
      mockPrismaService.like.create.mockResolvedValue({});

      const result = await service.toggleLike('song-1', 'user-1');
      expect(result).toEqual({ liked: true });
      expect(mockPrismaService.like.create).toHaveBeenCalled();
    });

    it('should delete a like if it exists', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue({ id: 'song-1' });
      mockPrismaService.like.findUnique.mockResolvedValue({
        userId: 'user-1',
        songId: 'song-1',
      });
      mockPrismaService.like.delete.mockResolvedValue({});

      const result = await service.toggleLike('song-1', 'user-1');
      expect(result).toEqual({ liked: false });
      expect(mockPrismaService.like.delete).toHaveBeenCalled();
    });
  });

  describe('getLikeStatus', () => {
    it('should return like count and status', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue({ id: 'song-1' });
      mockPrismaService.like.count.mockResolvedValue(5);
      mockPrismaService.like.findUnique.mockResolvedValue({
        userId: 'user-1',
        songId: 'song-1',
      });

      const result = await service.getLikeStatus('song-1', 'user-1');
      expect(result).toEqual({ count: 5, liked: true });
    });
  });

  describe('createComment', () => {
    it('should throw BadRequestException if content is empty', async () => {
      await expect(
        service.createComment('song-1', 'user-1', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a comment successfully', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue({ id: 'song-1' });
      const mockComment = {
        id: 'comment-1',
        content: 'Nice song!',
        userId: 'user-1',
      };
      mockPrismaService.comment.create.mockResolvedValue(mockComment);

      const result = await service.createComment(
        'song-1',
        'user-1',
        'Nice song!',
      );
      expect(result).toEqual(mockComment);
      expect(mockPrismaService.comment.create).toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('should throw ForbiddenException if user is not the author of the comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        userId: 'user-different',
      });
      await expect(
        service.deleteComment('comment-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete a comment if user is the author', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        userId: 'user-1',
      });
      mockPrismaService.comment.delete.mockResolvedValue({});

      const result = await service.deleteComment('comment-1', 'user-1');
      expect(result).toEqual({ success: true });
      expect(mockPrismaService.comment.delete).toHaveBeenCalled();
    });
  });
});
