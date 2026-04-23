import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogService } from '../src/modules/catalog/catalog.service';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../src/modules/user-records/user-records.service';
import { WorksService } from '../src/modules/works/works.service';
import { type PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';

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
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    catalogWork: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      type: WorkType.novel,
      title: 'The Three-Body Problem',
      author: 'Liu Cixin',
      genres: ['Sci-Fi'],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    ...overrides,
  } as WorkAggregate;
}

describe('WorksService', () => {
  let service: WorksService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let catalogService: jest.Mocked<Pick<CatalogService, 'create' | 'update'>>;
  let userRecordsService: jest.Mocked<
    Pick<
      UserRecordsService,
      'create' | 'findActiveByUser' | 'findActiveByUserAndId' | 'update'
    >
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
      findActiveByUser: jest.fn(),
      findActiveByUserAndId: jest.fn(),
      update: jest.fn(),
    };

    service = new WorksService(
      prisma as unknown as PrismaService,
      catalogService as unknown as CatalogService,
      userRecordsService as unknown as UserRecordsService,
    );
  });

  it('lists only active works for the current user ordered by updatedAt desc', async () => {
    userRecordsService.findActiveByUser.mockResolvedValue([
      createWorkAggregateFixture(),
    ]);

    const result = await service.findAll(USER_ID);

    expect(userRecordsService.findActiveByUser).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual([
      expect.objectContaining({
        id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        title: 'The Three-Body Problem',
      }),
    ]);
  });

  it('creates catalog metadata and a user record inside one transaction', async () => {
    const created = createWorkAggregateFixture({
      status: WorkStatus.planned,
      rating: null,
      catalogWork: {
        ...createWorkAggregateFixture().catalogWork,
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['Sci-Fi', 'Classic'],
      },
    });

    userRecordsService.create.mockResolvedValue(created);

    await service.create(USER_ID, {
      title: '  Dune  ',
      author: '  Frank Herbert ',
      genres: [' Sci-Fi ', 'Classic', 'Sci-Fi'],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(catalogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['Sci-Fi', 'Classic'],
        type: WorkType.novel,
      }),
      expect.any(Object),
    );
    expect(userRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        status: WorkStatus.planned,
        rating: null,
        favorite: false,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
      }),
      expect.any(Object),
    );
  });

  it('maps prisma sync status values back to the shared API domain', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(
      createWorkAggregateFixture({
        syncStatus: WorkSyncStatus.local_only,
      }),
    );

    await expect(
      service.findOne(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).resolves.toEqual(
      expect.objectContaining({
        syncStatus: 'local-only',
      }),
    );
  });

  it('throws not found for missing or foreign works', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(null);

    await expect(
      service.findOne(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes a work by setting deletedAt and incrementing serverVersion', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(
      createWorkAggregateFixture(),
    );
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        serverVersion: 2,
      }),
    );

    await service.remove(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28');

    expect(userRecordsService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {
        deletedAt: expect.any(Date),
        syncStatus: 'synced',
        serverVersion: {
          increment: 1,
        },
      },
    );
  });

  it('returns the current record when update payload is empty', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(
      createWorkAggregateFixture(),
    );

    const result = await service.update(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {},
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        syncStatus: 'synced',
      }),
    );
    expect(catalogService.update).not.toHaveBeenCalled();
    expect(userRecordsService.update).not.toHaveBeenCalled();
  });

  it('rejects blank titles on create and update', async () => {
    await expect(
      service.create(USER_ID, {
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    userRecordsService.findActiveByUserAndId.mockResolvedValue(
      createWorkAggregateFixture(),
    );

    await expect(
      service.update(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28', {
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates an active work and increments serverVersion when changes are present', async () => {
    const existing = createWorkAggregateFixture();
    const updated = createWorkAggregateFixture({
      favorite: true,
      serverVersion: 2,
      catalogWork: {
        ...existing.catalogWork,
        title: 'The Dark Forest',
      },
    });

    userRecordsService.findActiveByUserAndId.mockResolvedValue(existing);
    userRecordsService.update.mockResolvedValue(updated);

    const result = await service.update(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {
        title: 'The Dark Forest',
        favorite: true,
      },
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(catalogService.update).toHaveBeenCalledWith(
      existing.catalogWorkId,
      expect.objectContaining({
        title: 'The Dark Forest',
      }),
      expect.any(Object),
    );
    expect(userRecordsService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        favorite: true,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: {
          increment: 1,
        },
      }),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        title: 'The Dark Forest',
        favorite: true,
        serverVersion: 2,
      }),
    );
  });

  it('rejects update and delete attempts for missing or foreign works', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(null);

    await expect(
      service.update(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28', {
        favorite: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.remove(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
