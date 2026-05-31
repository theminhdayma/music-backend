import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { R2Service } from '../prisma/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { InitUploadDto } from './dto/init-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

interface UploadSession {
  uploadId: string;
  key: string;
  songId: string;
  parentSongId?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

@Injectable()
export class MusicUploadService {
  // In-memory session store (development / MVP scale)
  private sessions = new Map<string, UploadSession>();

  constructor(
    private r2Service: R2Service,
    private prisma: PrismaService,
    @InjectQueue('audio-analysis') private audioAnalysisQueue: Queue,
  ) {}

  async initializeUpload(ownerId: string, dto: InitUploadDto) {
    if (dto.parentSongId) {
      const parentSong = await this.prisma.song.findUnique({
        where: { id: dto.parentSongId },
      });
      if (!parentSong) {
        throw new NotFoundException(
          `Parent song with ID ${dto.parentSongId} not found`,
        );
      }
      if (!parentSong.remixAllowed) {
        throw new BadRequestException(
          `Remixing is not allowed for parent song "${parentSong.title}"`,
        );
      }
    }

    const sessionId = crypto.randomUUID();
    const songId = crypto.randomUUID();

    // Define unique R2 key
    const cleanFilename = dto.filename.replace(/\s+/g, '_');
    const key = `songs/${songId}/${cleanFilename}`;

    // Generate public file url
    const fileUrl = `${key}`; // Relational key path, public domain mapping will prepend R2 Domain.

    // 1. Create a placeholder Song record in database
    await this.prisma.song.create({
      data: {
        id: songId,
        ownerId,
        title: dto.title,
        genre: dto.genre || 'Unknown',
        fileUrl,
        licenseType: dto.licenseType || 'personal',
        processingStatus: 'queued',
        isPublished: false,
        licenseConfig: {
          create: {
            personalPrice: 0,
            personalEnabled: true,
            commercialPrice: 2999, // $29.99
            commercialEnabled: true,
            remixPrice: 1499, // $14.99
            remixEnabled: true,
            exclusivePrice: 49900, // $499.00
            exclusiveEnabled: false,
          },
        },
      },
    });

    // 2. Call R2 to initiate multipart upload
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.r2Service.getBucketName(),
        Key: key,
        ContentType: this.getContentType(dto.filename),
      });

      const response = await this.r2Service.getS3Client().send(command);
      const uploadId = response.UploadId;

      if (!uploadId) {
        throw new Error('Failed to retrieve UploadId from Cloudflare R2');
      }

      // 3. Store session
      this.sessions.set(sessionId, {
        uploadId,
        key,
        songId,
        parentSongId: dto.parentSongId,
      });

      return {
        sessionId,
        songId,
        uploadId,
        key,
      };
    } catch (error) {
      // Cleanup created song if init fails
      await this.prisma.song.delete({ where: { id: songId } }).catch(() => {});
      throw new BadRequestException(
        `R2 Multipart Init Failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async getPresignedUrl(sessionId: string, partNumber: number) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    try {
      const command = new UploadPartCommand({
        Bucket: this.r2Service.getBucketName(),
        Key: session.key,
        UploadId: session.uploadId,
        PartNumber: partNumber,
      });

      // Url expires in 1 hour
      const url = await getSignedUrl(this.r2Service.getS3Client(), command, {
        expiresIn: 3600,
      });
      return { url };
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate Presigned URL: ${getErrorMessage(error)}`,
      );
    }
  }

  async completeUpload(sessionId: string, dto: CompleteUploadDto) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    if (session.songId !== dto.songId) {
      throw new BadRequestException('Song ID mismatch for this upload session');
    }

    try {
      // Sort parts by PartNumber as required by S3/R2 specification
      const sortedParts = [...dto.parts].sort(
        (a, b) => a.PartNumber - b.PartNumber,
      );

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.r2Service.getBucketName(),
        Key: session.key,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: sortedParts.map((p) => ({
            PartNumber: p.PartNumber,
            ETag: p.ETag,
          })),
        },
      });

      await this.r2Service.getS3Client().send(command);

      // Clean up session
      this.sessions.delete(sessionId);

      // Update Song processing status and create initial OwnershipRelation in a transaction
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.song.update({
          where: { id: session.songId },
          data: {
            processingStatus: 'queued',
          },
        });

        const existingRelation = await tx.ownershipRelation.findFirst({
          where: { childSongId: session.songId },
        });

        if (!existingRelation) {
          if (session.parentSongId) {
            const parentSong = await tx.song.findUnique({
              where: { id: session.parentSongId },
              select: { royaltySplitRemixer: true, ownerId: true },
            });
            const splitPercentage = parentSong
              ? Number(parentSong.royaltySplitRemixer)
              : 20.0;

            const song = await tx.song.findUnique({
              where: { id: session.songId },
              select: { ownerId: true },
            });
            const ownerId = song ? song.ownerId : '';

            // Create remix relation
            await tx.ownershipRelation.create({
              data: {
                parentSongId: session.parentSongId,
                childSongId: session.songId,
                ownerId: ownerId,
                splitPercentage: splitPercentage,
                relationshipType: 'remix',
              },
            });
          } else {
            // Create original relation
            const song = await tx.song.findUnique({
              where: { id: session.songId },
              select: { ownerId: true },
            });
            const ownerId = song ? song.ownerId : '';

            await tx.ownershipRelation.create({
              data: {
                parentSongId: null,
                childSongId: session.songId,
                ownerId: ownerId,
                splitPercentage: 100.0,
                relationshipType: 'original',
              },
            });
          }
        }
      });

      // Enqueue Job in Redis BullMQ for FastAPI analysis
      await this.audioAnalysisQueue.add('analyze-audio', {
        songId: session.songId,
        fileUrl: session.key,
      });

      return {
        success: true,
        songId: session.songId,
      };
    } catch (error) {
      throw new BadRequestException(
        `R2 Multipart Completion Failed: ${getErrorMessage(error)}`,
      );
    }
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'flac') return 'audio/flac';
    return 'application/octet-stream';
  }
}
