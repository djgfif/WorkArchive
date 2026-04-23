import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UserRecordsController } from '../src/modules/user-records/user-records.controller';
import type { CatalogService } from '../src/modules/catalog/catalog.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { UserRecordsService, WorkAggregate } from '../src/modules/user-records/user-records.service';
import type { UserReleaseRecordsService } from '../src/modules/user-records/user-release-records.service';

function createWorkAggregate(
  overrides: Partial<WorkAggregate> = {},
): WorkAggregate {
  return {
    catalogTitle: null,
    catalogTitleId: 'catalog-title-1',
    catalogWork: {
      author: 'Author',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      description: '',
      genres: [],
      id: 'catalog-work-1',
      thumbnailUrl: '',
      title: 'Dune',
      type: WorkType.novel,
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    catalogWorkId: 'catalog-work-1',
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    favorite: false,
    id: 'record-1',
    lastConsumedLabel: null,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    rating: null,
    review: '',
    serverVersion: 1,
    shortReview: '',
    status: WorkStatus.completed,
    syncStatus: WorkSyncStatus.synced,
    tier: null,
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    userId: 'user-1',
    ...overrides,
  } as WorkAggregate;
}

describe('UserRecordsController', () => {
  let controller: UserRecordsController;
  let prisma: {
    catalogRelease: {
      findMany: jest.Mock;
    };
  };
  let userRecordsService: jest.Mocked<
    Pick<UserRecordsService, 'findActiveByUserAndId'>
  >;
  let releaseRecordsService: jest.Mocked<
    Pick<UserReleaseRecordsService, 'findByUserWorkRecord'>
  >;

  beforeEach(() => {
    prisma = {
      catalogRelease: {
        findMany: jest.fn(),
      },
    };
    userRecordsService = {
      findActiveByUserAndId: jest.fn(),
    };
    releaseRecordsService = {
      findByUserWorkRecord: jest.fn(),
    };
    controller = new UserRecordsController(
      prisma as unknown as PrismaService,
      {} as CatalogService,
      userRecordsService as unknown as UserRecordsService,
      releaseRecordsService as unknown as UserReleaseRecordsService,
    );
  });

  it('returns catalog releases together with matching user release records', async () => {
    userRecordsService.findActiveByUserAndId.mockResolvedValue(createWorkAggregate());
    prisma.catalogRelease.findMany.mockResolvedValue([
      {
        catalogTitleId: 'catalog-title-1',
        displayLabel: 'Vol. 1',
        id: 'release-1',
        isbn: '9781234567890',
        releaseDate: new Date('2026-04-18T00:00:00.000Z'),
        releaseType: 'volume',
        sequence: 1,
        summary: '',
        thumbnailUrl: 'https://example.com/vol1.jpg',
        title: 'Dune Vol. 1',
      },
    ] as never);
    releaseRecordsService.findByUserWorkRecord.mockResolvedValue([
      {
        catalogReleaseId: 'release-1',
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        deletedAt: null,
        favorite: false,
        id: 'user-release-1',
        rating: 4.5,
        review: '',
        serverVersion: 1,
        shortReview: 'Great volume',
        status: WorkStatus.completed,
        syncStatus: WorkSyncStatus.synced,
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        userId: 'user-1',
        userWorkRecordId: 'record-1',
      } as never,
    ]);

    const result = await controller.findReleases(
      { email: 'user@example.com', role: 'user', userId: 'user-1' },
      'record-1',
    );

    expect(result.releases).toEqual([
      expect.objectContaining({
        displayLabel: 'Vol. 1',
        id: 'release-1',
        userReleaseRecord: expect.objectContaining({
          id: 'user-release-1',
          rating: 4.5,
          status: WorkStatus.completed,
        }),
      }),
    ]);
  });
});
