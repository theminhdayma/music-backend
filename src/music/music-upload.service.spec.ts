/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { MusicUploadService } from './music-upload.service';
import { R2Service } from '../prisma/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getQueueToken } from '@nestjs/bullmq';

// Mock getSignedUrl from AWS S3 SDK
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));

describe('MusicUploadService', () => {
  let service: MusicUploadService;
  let prisma: PrismaService;

  const mockS3Client = {
    send: jest.fn(),
  };

  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
      song: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'song-uuid',
          ownerId: 'user-uuid',
          remixAllowed: true,
          royaltySplitRemixer: 20.0,
        }),
      },
      ownershipRelation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicUploadService,
        {
          provide: R2Service,
          useValue: {
            getS3Client: () => mockS3Client,
            getBucketName: () => 'music',
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: getQueueToken('audio-analysis'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<MusicUploadService>(MusicUploadService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initializeUpload', () => {
    it('should initialize multipart upload successfully', async () => {
      const mockSong = { id: 'song-uuid', title: 'Test Song' };
      (prisma.song.create as jest.Mock).mockResolvedValue(mockSong);
      mockS3Client.send.mockResolvedValue({ UploadId: 'mock-upload-id' });

      const result = await service.initializeUpload('user-uuid', {
        title: 'Test Song',
        genre: 'Pop',
        filename: 'test.mp3',
        fileSize: 1000000,
        licenseType: 'personal',
      });

      expect(result).toBeDefined();
      expect(result.uploadId).toBe('mock-upload-id');
      expect(result.sessionId).toBeDefined();
      expect(prisma.song.create).toHaveBeenCalled();
      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException and cleanup song on R2 error', async () => {
      const mockSong = { id: 'song-uuid' };
      (prisma.song.create as jest.Mock).mockResolvedValue(mockSong);
      mockS3Client.send.mockRejectedValue(new Error('S3 Connection Lost'));

      await expect(
        service.initializeUpload('user-uuid', {
          title: 'Test Song',
          filename: 'test.mp3',
          fileSize: 1000000,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.song.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: expect.any(String),
          },
        }),
      );
    });
  });

  describe('getPresignedUrl', () => {
    it('should return a presigned url for a valid session', async () => {
      // 1. Initialize session
      (prisma.song.create as jest.Mock).mockResolvedValue({ id: 'song-uuid' });
      mockS3Client.send.mockResolvedValue({ UploadId: 'mock-upload-id' });
      const init = await service.initializeUpload('user-uuid', {
        title: 'Test',
        filename: 'test.mp3',
        fileSize: 100,
      });

      // 2. Get URL
      const result = await service.getPresignedUrl(init.sessionId, 1);
      expect(result.url).toBe('https://mock-presigned-url.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid session', async () => {
      await expect(service.getPresignedUrl('non-existent', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeUpload', () => {
    it('should complete upload and update song status', async () => {
      // 1. Initialize session
      (prisma.song.create as jest.Mock).mockResolvedValue({ id: 'song-uuid' });
      mockS3Client.send.mockResolvedValue({ UploadId: 'mock-upload-id' });
      const init = await service.initializeUpload('user-uuid', {
        title: 'Test',
        filename: 'test.mp3',
        fileSize: 100,
      });

      // 2. Complete
      mockS3Client.send.mockResolvedValue({}); // mock complete upload S3 response
      (prisma.song.update as jest.Mock).mockResolvedValue({ id: init.songId });

      const result = await service.completeUpload(init.sessionId, {
        songId: init.songId,
        parts: [{ PartNumber: 1, ETag: 'etag' }],
      });

      expect(result.success).toBe(true);
      expect(result.songId).toBe(init.songId);
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: init.songId },
        data: { processingStatus: 'queued' },
      });
    });

    it('should throw BadRequestException if songId mismatch', async () => {
      (prisma.song.create as jest.Mock).mockResolvedValue({ id: 'song-uuid' });
      mockS3Client.send.mockResolvedValue({ UploadId: 'mock-upload-id' });
      const init = await service.initializeUpload('user-uuid', {
        title: 'Test',
        filename: 'test.mp3',
        fileSize: 100,
      });

      await expect(
        service.completeUpload(init.sessionId, {
          songId: 'different-uuid',
          parts: [{ PartNumber: 1, ETag: 'etag' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
