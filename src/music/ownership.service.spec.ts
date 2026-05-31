/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipService } from './ownership.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('OwnershipService', () => {
  let service: OwnershipService;
  let prisma: PrismaService;

  const mockPrismaService = {
    song: {
      findUnique: jest.fn(),
    },
    ownershipRelation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAncestors', () => {
    it('should throw NotFoundException if song does not exist', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue(null);
      await expect(service.getAncestors('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return ancestors list up to the root', async () => {
      const songA = { id: 'song-A', title: 'Song A', ownerId: 'user-1' };
      const songB = { id: 'song-B', title: 'Song B', ownerId: 'user-2' };
      const songC = { id: 'song-C', title: 'Song C', ownerId: 'user-3' };

      mockPrismaService.song.findUnique.mockResolvedValue(songC);

      // First query (C's parent is B)
      mockPrismaService.ownershipRelation.findFirst
        .mockResolvedValueOnce({
          parentSongId: 'song-B',
          childSongId: 'song-C',
          parent: songB,
        })
        // Second query (B's parent is A)
        .mockResolvedValueOnce({
          parentSongId: 'song-A',
          childSongId: 'song-B',
          parent: songA,
        })
        // Third query (A has no parent)
        .mockResolvedValueOnce(null);

      const result = await service.getAncestors('song-C');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(songB);
      expect(result[1]).toEqual(songA);
    });
  });

  describe('getDescendants', () => {
    it('should throw NotFoundException if song does not exist', async () => {
      mockPrismaService.song.findUnique.mockResolvedValue(null);
      await expect(service.getDescendants('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return descendants list recursively', async () => {
      const songA = { id: 'song-A', title: 'Song A' };
      const songB = { id: 'song-B', title: 'Song B' };
      const songC = { id: 'song-C', title: 'Song C' };

      mockPrismaService.song.findUnique.mockResolvedValue(songA);

      // A's children: B
      mockPrismaService.ownershipRelation.findMany
        .mockResolvedValueOnce([
          {
            parentSongId: 'song-A',
            childSongId: 'song-B',
            child: songB,
          },
        ])
        // B's children: C
        .mockResolvedValueOnce([
          {
            parentSongId: 'song-B',
            childSongId: 'song-C',
            child: songC,
          },
        ])
        // C's children: none
        .mockResolvedValueOnce([]);

      const result = await service.getDescendants('song-A');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(songB);
      expect(result[1]).toEqual(songC);
    });
  });

  describe('getGraphData', () => {
    it('should return horizontal tree node and link graph data', async () => {
      const rootSong = {
        id: 'song-A',
        title: 'Song A',
        owner: { id: 'user-1', displayName: 'Creator A' },
      };

      const childSong = {
        id: 'song-B',
        title: 'Song B Remix',
        owner: { id: 'user-2', displayName: 'Remixer B' },
      };

      // Finding root song: from B, we find parent is A
      mockPrismaService.ownershipRelation.findFirst
        .mockResolvedValueOnce({
          parentSongId: 'song-A',
          childSongId: 'song-B',
        })
        // from A, we find no parent
        .mockResolvedValueOnce(null);

      mockPrismaService.song.findUnique.mockResolvedValue(rootSong);

      // BFS traversal:
      // A's children: B
      mockPrismaService.ownershipRelation.findMany
        .mockResolvedValueOnce([
          {
            parentSongId: 'song-A',
            childSongId: 'song-B',
            splitPercentage: 20.0,
            relationshipType: 'remix',
            child: childSong,
          },
        ])
        // B's children: none
        .mockResolvedValueOnce([]);

      const result = await service.getGraphData('song-B');
      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
      expect(result.nodes[0]).toEqual({
        id: 'song-A',
        title: 'Song A',
        owner: 'Creator A',
        ownerId: 'user-1',
        type: 'original',
      });
      expect(result.nodes[1]).toEqual({
        id: 'song-B',
        title: 'Song B Remix',
        owner: 'Remixer B',
        ownerId: 'user-2',
        type: 'remix',
      });
      expect(result.links[0]).toEqual({
        source: 'song-A',
        target: 'song-B',
        split: 20.0,
      });
    });
  });
});
