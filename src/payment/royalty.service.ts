import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoyaltyService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string) {
    let wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Create empty wallet if not exists
      wallet = await this.prisma.userWallet.create({
        data: {
          userId,
          balanceUsd: 0,
          totalEarned: 0,
        },
      });
    }

    return wallet;
  }

  async getTransactions(userId: string) {
    return this.prisma.royaltyTransaction.findMany({
      where: { userId },
      include: {
        song: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Distribute royalties recursively up the ownership tree
   * @param songId The ID of the purchased song (the target of the license)
   * @param amount The total paid amount in cents (e.g. $100.00 = 10000 cents)
   * @param eventId The UUID of the transaction event (e.g. UserLicense ID)
   */
  async distributeRoyalty(songId: string, amount: number, eventId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let currentSongId = songId;
      let currentAmount = amount;
      const targetSongId = songId;

      while (currentSongId) {
        const relation = await tx.ownershipRelation.findFirst({
          where: { childSongId: currentSongId },
        });

        if (!relation) {
          // If no relation found, we cannot trace further. Stop split.
          break;
        }

        const isDirectPurchase = currentSongId === targetSongId;

        if (relation.parentSongId !== null) {
          // Remix level
          const platformFeeRate = 0.1; // 10%
          const remixerRate = Number(relation.splitPercentage) / 100; // e.g. 20% = 0.20

          const platformFee = Math.round(currentAmount * platformFeeRate);
          const remixerShare = Math.round(currentAmount * remixerRate);
          const remainingAmount = currentAmount - platformFee - remixerShare;

          // Credit remixer's wallet
          await tx.userWallet.upsert({
            where: { userId: relation.ownerId },
            update: {
              balanceUsd: { increment: remixerShare },
              totalEarned: { increment: remixerShare },
            },
            create: {
              userId: relation.ownerId,
              balanceUsd: remixerShare,
              totalEarned: remixerShare,
            },
          });

          // Create royalty transaction for remixer
          await tx.royaltyTransaction.create({
            data: {
              userId: relation.ownerId,
              songId: currentSongId,
              eventType: 'license_purchase',
              eventId: eventId,
              role: 'remixer',
              grossAmount: currentAmount,
              platformFee: platformFee,
              netAmount: remixerShare,
              status: 'credited',
            },
          });

          // Move up to the parent song with the remaining amount
          currentSongId = relation.parentSongId;
          currentAmount = remainingAmount;
        } else {
          // Root (Original Creator) level
          // Platform fee is 10% only if direct purchase of the original song, otherwise 0%
          const platformFee = isDirectPurchase
            ? Math.round(currentAmount * 0.1)
            : 0;
          const creatorShare = currentAmount - platformFee;

          // Credit original creator's wallet
          await tx.userWallet.upsert({
            where: { userId: relation.ownerId },
            update: {
              balanceUsd: { increment: creatorShare },
              totalEarned: { increment: creatorShare },
            },
            create: {
              userId: relation.ownerId,
              balanceUsd: creatorShare,
              totalEarned: creatorShare,
            },
          });

          // Create royalty transaction for original creator
          await tx.royaltyTransaction.create({
            data: {
              userId: relation.ownerId,
              songId: currentSongId,
              eventType: 'license_purchase',
              eventId: eventId,
              role: 'original_creator',
              grossAmount: currentAmount,
              platformFee: platformFee,
              netAmount: creatorShare,
              status: 'credited',
            },
          });

          // Original level reached and handled, stop traversal
          break;
        }
      }
    });
  }
}
