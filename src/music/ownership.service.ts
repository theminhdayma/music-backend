import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface OwnershipNode {
  id: string;
  title: string;
  owner: string;
  ownerId: string;
  type: string;
}

interface OwnershipLink {
  source: string | null;
  target: string;
  split: number;
}

@Injectable()
export class OwnershipService {
  constructor(private prisma: PrismaService) {}

  async getAncestors(songId: string) {
    // Check if song exists
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const ancestors = [];
    let currentSongId: string | null = songId;

    while (currentSongId) {
      const relation: Prisma.OwnershipRelationGetPayload<{
        include: {
          parent: {
            include: {
              owner: {
                select: {
                  id: true;
                  displayName: true;
                  email: true;
                };
              };
            };
          };
        };
      }> | null = await this.prisma.ownershipRelation.findFirst({
        where: { childSongId: currentSongId },
        include: {
          parent: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (relation && relation.parentSongId && relation.parent) {
        ancestors.push(relation.parent);
        currentSongId = relation.parentSongId;
      } else {
        break;
      }
    }

    return ancestors;
  }

  async getDescendants(songId: string) {
    // Check if song exists
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
    });
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const descendants: Array<unknown> = [];
    const queue: string[] = [songId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      visited.add(currentId);

      const relations = await this.prisma.ownershipRelation.findMany({
        where: { parentSongId: currentId },
        include: {
          child: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      for (const rel of relations) {
        if (!visited.has(rel.childSongId)) {
          descendants.push(rel.child);
          queue.push(rel.childSongId);
        }
      }
    }

    return descendants;
  }

  async getGraphData(songId: string) {
    // 1. Find root parent song
    let rootSongId = songId;
    while (true) {
      const parentRel = await this.prisma.ownershipRelation.findFirst({
        where: { childSongId: rootSongId, parentSongId: { not: null } },
      });
      if (parentRel && parentRel.parentSongId) {
        rootSongId = parentRel.parentSongId;
      } else {
        break;
      }
    }

    // 2. Fetch root song details
    const rootSong = await this.prisma.song.findUnique({
      where: { id: rootSongId },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!rootSong) {
      throw new NotFoundException(`Root song not found for song ID ${songId}`);
    }

    // 3. BFS traversal to build nodes and links
    const nodesMap = new Map<string, OwnershipNode>();
    nodesMap.set(rootSongId, {
      id: rootSongId,
      title: rootSong.title,
      owner: rootSong.owner.displayName || 'Unknown',
      ownerId: rootSong.owner.id,
      type: 'original',
    });

    const links: OwnershipLink[] = [];
    const queue: string[] = [rootSongId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      visited.add(currentId);

      const relations = await this.prisma.ownershipRelation.findMany({
        where: { parentSongId: currentId },
        include: {
          child: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      for (const rel of relations) {
        if (!nodesMap.has(rel.childSongId)) {
          nodesMap.set(rel.childSongId, {
            id: rel.childSongId,
            title: rel.child.title,
            owner: rel.child.owner.displayName || 'Unknown',
            ownerId: rel.child.owner.id,
            type: rel.relationshipType || 'remix',
          });
        }

        links.push({
          source: rel.parentSongId,
          target: rel.childSongId,
          split: Number(rel.splitPercentage),
        });

        if (!visited.has(rel.childSongId)) {
          queue.push(rel.childSongId);
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  }

  async getUserOwnerships(userId: string) {
    return this.prisma.ownershipRelation.findMany({
      where: { ownerId: userId },
      include: {
        child: {
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }
}
