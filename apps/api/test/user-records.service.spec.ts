import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UserRecordsService } from '../src/modules/user-records/user-records.service';
import type { CatalogService } from '../src/modules/catalog/catalog.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type {
  UserReleaseRecordAggregate,
  UserReleaseRecordsService,
} from '../src/modules/user-records/user-release-records.service';

describe('UserRecordsService', () => {
  let service: UserRecordsService;
  let prisma: {
    catalogRelease: {
      findMany: jest.Mock;
    };
    userWorkRecord: {
      findFirst: jest.Mock;
    };
  };
  let releaseRecordsService: jest.Mocked<
    Pick<UserReleaseRecordsService, 'findByUserWorkRecord'>
  >;

  beforeEach(() => {
    prisma = {
      catalogRelease: {
        findMany: jest.fn(),
      },
      userWorkRecord: {
        findFirst: jest.fn(),
      },
    };
    releaseRecordsService = {
      findByUserWorkRecord: jest.fn(),
    };
    service = new UserRecordsService(
      prisma as unknown as PrismaService,
      {} as CatalogService,
      releaseRecordsService as unknown as UserReleaseRecordsService,
    );
  });

  it('returns catalog releases together with matching user release records', async () => {
    prisma.userWorkRecord.findFirst.mockResolvedValue({
      catalogTitle: {
        mediumType: WorkType.novel,
      },
      catalogTitleId: 'catalog-title-1',
      catalogWork: {
        type: WorkType.novel,
      },
      id: 'record-1',
      userId: 'user-1',
    } as never);
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
        userWorkRecordId: 'record-1',
      } as UserReleaseRecordAggregate,
    ]);

    const result = await service.getReleasesView('user-1', 'record-1');

    expect(prisma.userWorkRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'record-1',
          userId: 'user-1',
        }),
      }),
    );
    expect(result.releases).toEqual([
      expect.objectContaining({
        displayLabel: 'Vol. 1',
        id: 'release-1',
        releaseDate: '2026-04-18T00:00:00.000Z',
        userReleaseRecord: expect.objectContaining({
          createdAt: '2026-04-18T00:00:00.000Z',
          id: 'user-release-1',
          rating: 4.5,
          status: WorkStatus.completed,
        }),
      }),
    ]);
  });
});
