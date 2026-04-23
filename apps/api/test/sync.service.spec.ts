import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogService } from '../src/modules/catalog/catalog.service';
import { SyncService } from '../src/modules/sync/sync.service';
import type { SyncWorkPayloadDto } from '../src/modules/sync/dto/sync-work-payload.dto';
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

function createSyncPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
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
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'pending',
    serverVersion: 3,
    ...overrides,
  };
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

  it('applies queued creates in createdAt order even when the payloads arrive out of order', async () => {
    userRecordsService.findById.mockResolvedValue(null);
    userRecordsService.create.mockResolvedValue(createWorkAggregateFixture());

    await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '11111111-1111-4111-8111-111111111111',
          operation: 'create',
          createdAt: '2026-04-18T00:10:00.000Z',
          payload: createSyncPayload({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Second change',
            createdAt: '2026-04-18T00:10:00.000Z',
            updatedAt: '2026-04-18T00:10:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
        {
          queueId: '4cc40859-3c61-4056-aabd-c9471d6f4dfd',
          entityType: 'work',
          entityId: '22222222-2222-4222-8222-222222222222',
          operation: 'create',
          createdAt: '2026-04-18T00:05:00.000Z',
          payload: createSyncPayload({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'First change',
            createdAt: '2026-04-18T00:05:00.000Z',
            updatedAt: '2026-04-18T00:05:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(catalogService.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        title: 'First change',
      }),
    );
    expect(catalogService.create.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Second change',
      }),
    );
  });

  it('returns applied with a stable already-applied message for duplicate push payloads', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T01:05:00.000Z',
          payload: createSyncPayload(),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        message: 'Remote record already matches the queued change.',
        work: expect.objectContaining({
          id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          serverVersion: 3,
        }),
      }),
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a missing remote record for a local-only payload and assigns the authenticated owner', async () => {
    const importedId = '33333333-3333-4333-8333-333333333333';

    userRecordsService.findById.mockResolvedValue(null);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogWorkId: importedId,
        serverVersion: 1,
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          id: importedId,
          title: 'Imported Dune',
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        },
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'eab7b702-fab8-43d0-9170-175f4bc5f713',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            title: 'Imported Dune',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(catalogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        title: 'Imported Dune',
      }),
      expect.any(Object),
    );
    expect(userRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        userId: USER_ID,
        catalogWorkId: importedId,
        serverVersion: 1,
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        work: expect.objectContaining({
          id: importedId,
          title: 'Imported Dune',
          serverVersion: 1,
        }),
      }),
    ]);
  });

  it('applies tombstone payloads and increments the server version', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
        serverVersion: 4,
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '5a3ea445-68dc-4842-a62d-7e3d36f1b045',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'delete',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createSyncPayload({
            deletedAt: '2026-04-18T02:00:00.000Z',
            updatedAt: '2026-04-18T02:00:00.000Z',
          }),
        },
      ],
    });

    expect(userRecordsService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        syncStatus: WorkSyncStatus.synced,
        serverVersion: {
          increment: 1,
        },
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        message: 'Queued tombstone applied on the server.',
        work: expect.objectContaining({
          deletedAt: new Date('2026-04-18T02:00:00.000Z'),
          serverVersion: 4,
        }),
      }),
    ]);
  });

  it('keeps the incoming pull cursor when there are no newer records', async () => {
    userRecordsService.findByUserSince.mockResolvedValue([]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        nextSince: '2026-04-18T00:00:00.000Z',
        changes: [],
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
