import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SyncService } from '../src/modules/sync/sync.service';
import { type PrismaService } from '../src/prisma/prisma.service';

function createWorkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: WorkType.novel,
    title: 'The Three-Body Problem',
    author: 'Liu Cixin',
    genres: ['Sci-Fi'],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 3,
    ...overrides,
  };
}

describe('SyncService', () => {
  let service: SyncService;
  let prisma: jest.Mocked<Pick<PrismaService, 'work'>>;

  beforeEach(() => {
    prisma = {
      work: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'work'>>;

    service = new SyncService(prisma as unknown as PrismaService);
  });

  it('returns a conflict when the server version is newer and the server wins', async () => {
    prisma.work.findUnique.mockResolvedValue(createWorkFixture());

    const result = await service.push({
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
            type: 'novel',
            title: 'The Dark Forest',
            author: 'Liu Cixin',
            genres: ['Sci-Fi'],
            description: '',
            thumbnailUrl: '',
            status: 'completed',
            rating: 5,
            shortReview: '',
            review: '',
            tier: null,
            favorite: false,
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:30:00.000Z',
            deletedAt: null,
            syncStatus: 'pending',
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'conflict',
        message: expect.stringContaining('server version 3'),
      }),
    ]);
    expect(prisma.work.update).not.toHaveBeenCalled();
  });

  it('pulls tombstones and uses updatedAt as the next cursor', async () => {
    prisma.work.findMany.mockResolvedValue([
      createWorkFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    ]);

    const result = await service.pull({
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(prisma.work.findMany).toHaveBeenCalledWith({
      where: {
        updatedAt: {
          gt: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        nextSince: '2026-04-18T02:00:00.000Z',
        changes: [
          expect.objectContaining({
            operation: 'delete',
            entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          }),
        ],
      }),
    );
  });
});
