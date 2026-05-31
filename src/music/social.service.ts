import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  async toggleLike(songId: string, userId: string) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_songId: {
          userId,
          songId,
        },
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: {
          userId_songId: {
            userId,
            songId,
          },
        },
      });
      return { liked: false };
    } else {
      await this.prisma.like.create({
        data: {
          userId,
          songId,
        },
      });
      return { liked: true };
    }
  }

  async getLikeStatus(songId: string, userId?: string) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const count = await this.prisma.like.count({
      where: { songId },
    });

    let liked = false;
    if (userId) {
      const like = await this.prisma.like.findUnique({
        where: {
          userId_songId: {
            userId,
            songId,
          },
        },
      });
      liked = !!like;
    }

    return { count, liked };
  }

  async createComment(songId: string, userId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    return this.prisma.comment.create({
      data: {
        songId,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async getComments(songId: string) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    return this.prisma.comment.findMany({
      where: { songId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this comment',
      );
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }
}
