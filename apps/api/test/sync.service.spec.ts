import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SyncService } from '../src/modules/sync/sync.service';
import { type PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'a3fba91f-71c3-46a2-b126-c4cbca6dd1a8';

function createWorkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    userId: USER_ID,
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

    const result = await service.push(USER_ID, {
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

  it('refuses to modify a record that belongs to another user', async () => {
    prisma.work.findUnique.mockResolvedValue(
      createWorkFixture({
        userId: OTHER_USER_ID,
      }),
    );

    const result = await service.push(USER_ID, {
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
        message: expect.stringContaining('cannot be modified remotely'),
        work: null,
      }),
    ]);
  });

  it('pulls tombstones for the current user and uses updatedAt as the next cursor', async () => {
    prisma.work.findMany.mockResolvedValue([
      createWorkFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    ]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(prisma.work.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
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

  it('returns a conflict when a previously synced delete targets a missing remote record', async () => {
    prisma.work.findUnique.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'delete',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
            type: 'novel',
            title: 'The Three-Body Problem',
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
            deletedAt: '2026-04-18T00:30:00.000Z',
            syncStatus: 'pending',
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'conflict',
        message: expect.stringContaining('already missing remotely'),
        work: null,
      }),
    ]);
    expect(prisma.work.create).not.toHaveBeenCalled();
  });
});
