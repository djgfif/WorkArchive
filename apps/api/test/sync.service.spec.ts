import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogService } from '../src/modules/catalog/catalog.service';
import { SyncService } from '../src/modules/sync/sync.service';
import { type PrismaService } from '../src/prisma/prisma.service';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../src/modules/user-records/user-records.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'a3fba91f-71c3-46a2-b126-c4cbca6dd1a8';

function createWorkAggregateFixture(
  overrides: Partial<WorkAggregate> = {},
): WorkAggregate {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    userId: USER_ID,
    catalogWorkId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
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
    catalogWork: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      type: WorkType.novel,
      title: 'The Three-Body Problem',
      author: 'Liu Cixin',
      genres: ['Sci-Fi'],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    },
    ...overrides,
  } as WorkAggregate;
}

describe('SyncService', () => {
  let service: SyncService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let catalogService: jest.Mocked<Pick<CatalogService, 'create' | 'update'>>;
  let userRecordsService: jest.Mocked<
    Pick<UserRecordsService, 'create' | 'findById' | 'findByUserSince' | 'update'>
  >;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args[0] as (client: never) => Promise<unknown>;

      return callback({} as never);
    });
    catalogService = {
      create: jest.fn(),
      update: jest.fn(),
    };
    userRecordsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserSince: jest.fn(),
      update: jest.fn(),
    };

    service = new SyncService(
      prisma as unknown as PrismaService,
      catalogService as unknown as CatalogService,
      userRecordsService as unknown as UserRecordsService,
    );
  });

  it('returns a conflict when the server version is newer and the server wins', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());

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
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to modify a record that belongs to another user', async () => {
    userRecordsService.findById.mockResolvedValue(
      createWorkAggregateFixture({
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
    userRecordsService.findByUserSince.mockResolvedValue([
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    ]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(userRecordsService.findByUserSince).toHaveBeenCalledWith(
      USER_ID,
      new Date('2026-04-18T00:00:00.000Z'),
    );
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
    userRecordsService.findById.mockResolvedValue(null);

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
    expect(catalogService.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });
});
