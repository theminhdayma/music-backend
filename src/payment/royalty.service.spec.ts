/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { RoyaltyService } from './royalty.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoyaltyService', () => {
  let service: RoyaltyService;
  let prisma: PrismaService;

  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
      userWallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
      royaltyTransaction: {
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      ownershipRelation: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoyaltyService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<RoyaltyService>(RoyaltyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWallet', () => {
    it('should return existing wallet if found', async () => {
      const mockWallet = { userId: 'user-1', balanceUsd: 1000 };
      prismaMock.userWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWallet('user-1');
      expect(result).toEqual(mockWallet);
      expect(prismaMock.userWallet.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prismaMock.userWallet.create).not.toHaveBeenCalled();
    });

    it('should create and return new wallet if not found', async () => {
      prismaMock.userWallet.findUnique.mockResolvedValue(null);
      const mockNewWallet = { userId: 'user-1', balanceUsd: 0 };
      prismaMock.userWallet.create.mockResolvedValue(mockNewWallet);

      const result = await service.getWallet('user-1');
      expect(result).toEqual(mockNewWallet);
      expect(prismaMock.userWallet.create).toHaveBeenCalled();
    });
  });

  describe('distributeRoyalty', () => {
    it('should split royalties for original song direct purchase (10% platform, 90% creator)', async () => {
      // Setup original song relation
      prismaMock.ownershipRelation.findFirst.mockResolvedValue({
        parentSongId: null,
        childSongId: 'song-original',
        ownerId: 'creator-uuid',
        splitPercentage: 100.0,
        relationshipType: 'original',
      });

      await service.distributeRoyalty('song-original', 10000, 'event-uuid');

      // Check upsert called for creator wallet
      expect(prismaMock.userWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'creator-uuid' },
          update: {
            balanceUsd: { increment: 9000 },
            totalEarned: { increment: 9000 },
          },
          create: {
            userId: 'creator-uuid',
            balanceUsd: 9000,
            totalEarned: 9000,
          },
        }),
      );

      // Check transaction created
      expect(prismaMock.royaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'creator-uuid',
            songId: 'song-original',
            eventType: 'license_purchase',
            eventId: 'event-uuid',
            role: 'original_creator',
            grossAmount: 10000,
            platformFee: 1000,
            netAmount: 9000,
            status: 'credited',
          },
        }),
      );
    });

    it('should recursively split royalties for remix song purchase (10% platform, 20% remixer, rest up)', async () => {
      // Remix C of B. B is remix of A. A is original.
      // C is the target.
      // First query (C relation): C belongs to Z, parent is B. Split is 20%.
      prismaMock.ownershipRelation.findFirst
        .mockResolvedValueOnce({
          parentSongId: 'song-B',
          childSongId: 'song-C',
          ownerId: 'remixer-Z',
          splitPercentage: 20.0,
          relationshipType: 'remix',
        })
        // Second query (B relation): B belongs to Y, parent is A. Split is 20%.
        .mockResolvedValueOnce({
          parentSongId: 'song-A',
          childSongId: 'song-B',
          ownerId: 'remixer-Y',
          splitPercentage: 20.0,
          relationshipType: 'remix',
        })
        // Third query (A relation): A belongs to X, parent is null.
        .mockResolvedValueOnce({
          parentSongId: null,
          childSongId: 'song-A',
          ownerId: 'creator-X',
          splitPercentage: 100.0,
          relationshipType: 'original',
        });

      await service.distributeRoyalty('song-C', 10000, 'event-uuid');

      // Level C calculation:
      // Gross = 10000. Platform = 10% = 1000. Remixer Z share = 20% = 2000. Remainder = 7000.
      expect(prismaMock.userWallet.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { userId: 'remixer-Z' },
          create: { userId: 'remixer-Z', balanceUsd: 2000, totalEarned: 2000 },
        }),
      );
      expect(prismaMock.royaltyTransaction.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: {
            userId: 'remixer-Z',
            songId: 'song-C',
            eventType: 'license_purchase',
            eventId: 'event-uuid',
            role: 'remixer',
            grossAmount: 10000,
            platformFee: 1000,
            netAmount: 2000,
            status: 'credited',
          },
        }),
      );

      // Level B calculation:
      // Gross = 7000. Platform = 10% = 700. Remixer Y share = 20% = 1400. Remainder = 4900.
      expect(prismaMock.userWallet.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { userId: 'remixer-Y' },
          create: { userId: 'remixer-Y', balanceUsd: 1400, totalEarned: 1400 },
        }),
      );
      expect(prismaMock.royaltyTransaction.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: {
            userId: 'remixer-Y',
            songId: 'song-B',
            eventType: 'license_purchase',
            eventId: 'event-uuid',
            role: 'remixer',
            grossAmount: 7000,
            platformFee: 700,
            netAmount: 1400,
            status: 'credited',
          },
        }),
      );

      // Level A (Original Creator X) calculation:
      // Gross = 4900. Since it's reached as an ancestor (not direct target C), platform fee is 0%.
      // Creator X share = 4900.
      expect(prismaMock.userWallet.upsert).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: { userId: 'creator-X' },
          create: { userId: 'creator-X', balanceUsd: 4900, totalEarned: 4900 },
        }),
      );
      expect(prismaMock.royaltyTransaction.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          data: {
            userId: 'creator-X',
            songId: 'song-A',
            eventType: 'license_purchase',
            eventId: 'event-uuid',
            role: 'original_creator',
            grossAmount: 4900,
            platformFee: 0,
            netAmount: 4900,
            status: 'credited',
          },
        }),
      );
    });
  });
});
