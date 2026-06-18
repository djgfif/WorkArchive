import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CatalogWorkSource,
  WorkStatus,
  WorkSyncStatus,
  WorkType,
} from '@prisma/client';
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
    personalTags: [],
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    catalogWork: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      source: CatalogWorkSource.legacy_flat,
      type: WorkType.novel,
      title: 'The Three-Body Problem',
      author: 'Liu Cixin',
      genres: ['판타지'],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    catalogTitle: null,
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
      | 'create'
      | 'findActiveByUser'
      | 'findActiveByUserAndId'
      | 'update'
      | 'updateActiveForUser'
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
      updateActiveForUser: jest.fn(),
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

  it('prefers catalog title metadata when returning the flat work response', async () => {
    userRecordsService.findActiveByUser.mockResolvedValue([
      createWorkAggregateFixture({
        catalogTitleId: 'catalog-title-1',
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          type: WorkType.novel,
          title: 'Legacy Work Title',
          author: 'Legacy Author',
          description: 'Legacy description',
          thumbnailUrl: 'https://example.com/legacy.jpg',
        },
        catalogTitle: {
          id: 'catalog-title-1',
          mediumType: WorkType.web_novel,
          displayTitle: 'Catalog Title',
          summary: 'Catalog summary',
          thumbnailUrl: 'https://example.com/catalog.jpg',
          contributors: [
            {
              role: 'illustrator',
              contributor: {
                displayName: 'Illustrator Name',
              },
            },
            {
              role: 'author',
              contributor: {
                displayName: 'Catalog Author',
              },
            },
          ],
        } as never,
      }),
    ]);

    const result = await service.findAll(USER_ID);

    expect(result).toEqual([
      expect.objectContaining({
        catalogTitleId: 'catalog-title-1',
        type: WorkType.web_novel,
        title: 'Catalog Title',
        author: 'Catalog Author',
        genres: ['판타지'],
        description: 'Catalog summary',
        thumbnailUrl: 'https://example.com/catalog.jpg',
      }),
    ]);
  });

  it('falls back to catalog work thumbnails when catalog title thumbnails are blank', async () => {
    userRecordsService.findActiveByUser.mockResolvedValue([
      createWorkAggregateFixture({
        catalogTitleId: 'catalog-title-1',
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          thumbnailUrl: 'https://example.com/legacy-cover.jpg',
        },
        catalogTitle: {
          id: 'catalog-title-1',
          mediumType: WorkType.novel,
          displayTitle: 'Catalog Title',
          summary: 'Catalog summary',
          thumbnailUrl: '',
          contributors: [],
        } as never,
      }),
    ]);

    const result = await service.findAll(USER_ID);

    expect(result[0]).toEqual(
      expect.objectContaining({
        thumbnailUrl: 'https://example.com/legacy-cover.jpg',
      }),
    );
  });

  it('creates catalog metadata and a user record inside one transaction', async () => {
    const created = createWorkAggregateFixture({
      status: WorkStatus.planned,
      rating: null,
      catalogWork: {
        ...createWorkAggregateFixture().catalogWork,
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['판타지'],
      },
    });

    userRecordsService.create.mockResolvedValue(created);

    await service.create(USER_ID, {
      title: '  Dune  ',
      author: '  Frank Herbert ',
      genres: [' 회귀 ', '판타지', '빙의', '판타지'],
      personalTags: ['완결까지'],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(catalogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['판타지'],
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
        personalTags: ['완결까지', '회귀', '빙의'],
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
    userRecordsService.updateActiveForUser.mockResolvedValue(
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        serverVersion: 2,
      }),
    );

    await service.remove(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28');

    expect(userRecordsService.updateActiveForUser).toHaveBeenCalledWith(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {
        deletedAt: expect.any(Date),
        syncStatus: 'synced',
        serverVersion: {
          increment: 1,
        },
      },
      undefined,
      {
        includeDeletedResult: true,
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
    expect(userRecordsService.updateActiveForUser).not.toHaveBeenCalled();
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
      personalTags: ['다시 볼 것', '여운 강함'],
      serverVersion: 2,
      catalogWork: {
        ...existing.catalogWork,
        title: 'The Dark Forest',
      },
    });

    userRecordsService.findActiveByUserAndId.mockResolvedValue(existing);
    userRecordsService.updateActiveForUser.mockResolvedValue(updated);

    const result = await service.update(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {
        title: 'The Dark Forest',
        favorite: true,
        personalTags: ['다시 볼 것', '여운 강함'],
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
    expect(userRecordsService.updateActiveForUser).toHaveBeenCalledWith(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        favorite: true,
        personalTags: ['다시 볼 것', '여운 강함'],
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
        personalTags: ['다시 볼 것', '여운 강함'],
        serverVersion: 2,
      }),
    );
  });

  it('moves unknown update genres into personal tags without rejecting the request', async () => {
    const existing = createWorkAggregateFixture({
      personalTags: ['기존 태그'],
      catalogWork: {
        ...createWorkAggregateFixture().catalogWork,
        genres: ['판타지'],
      },
    });
    const updated = createWorkAggregateFixture({
      personalTags: ['기존 태그', '회귀', '빙의'],
      catalogWork: {
        ...existing.catalogWork,
        genres: ['판타지'],
      },
    });

    userRecordsService.findActiveByUserAndId.mockResolvedValue(existing);
    userRecordsService.updateActiveForUser.mockResolvedValue(updated);

    await service.update(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28', {
      genres: ['회귀', '판타지', '빙의'],
    });

    expect(catalogService.update).toHaveBeenCalledWith(
      existing.catalogWorkId,
      expect.objectContaining({
        genres: ['판타지'],
      }),
      expect.any(Object),
    );
    expect(userRecordsService.updateActiveForUser).toHaveBeenCalledWith(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        personalTags: ['기존 태그', '회귀', '빙의'],
      }),
      expect.any(Object),
    );
  });

  it('rejects update and delete attempts for missing or foreign works', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(null);
    userRecordsService.updateActiveForUser.mockRejectedValue(
      new NotFoundException(
        'User record with id "9fcbf92f-6347-4d79-bdf8-9d0d18439c28" was not found.',
      ),
    );

    await expect(
      service.update(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28', {
        favorite: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(catalogService.update).not.toHaveBeenCalled();
    expect(userRecordsService.updateActiveForUser).not.toHaveBeenCalled();

    await expect(
      service.remove(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRecordsService.updateActiveForUser).toHaveBeenCalledWith(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        deletedAt: expect.any(Date),
      }),
      undefined,
      {
        includeDeletedResult: true,
      },
    );
  });
});
