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
      updateMany: jest.Mock;
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
        updateMany: jest.fn(),
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

  it('updates active records with user ownership and deletedAt scope in the mutation predicate', async () => {
    prisma.userWorkRecord.updateMany.mockImplementation(async () => ({
      count: 1,
    }));
    prisma.userWorkRecord.findFirst.mockResolvedValue({
      catalogTitle: null,
      catalogTitleId: 'record-1',
      catalogWork: {
        type: WorkType.novel,
      },
      deletedAt: null,
      favorite: true,
      id: 'record-1',
      personalTags: [],
      rating: 4,
      review: '',
      shortReview: '',
      status: WorkStatus.completed,
      syncStatus: WorkSyncStatus.synced,
      userId: 'user-1',
    } as never);

    await expect(
      service.updateActiveForUser('user-1', 'record-1', {
        favorite: true,
        serverVersion: {
          increment: 1,
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'record-1',
        userId: 'user-1',
      }),
    );

    expect(prisma.userWorkRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          id: 'record-1',
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.userWorkRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          id: 'record-1',
          userId: 'user-1',
        },
      }),
    );
  });

  it('can return a just-deleted record after an owner-scoped active mutation', async () => {
    prisma.userWorkRecord.updateMany.mockImplementation(async () => ({
      count: 1,
    }));
    prisma.userWorkRecord.findFirst.mockResolvedValue({
      catalogTitle: null,
      catalogTitleId: 'record-1',
      catalogWork: {
        type: WorkType.novel,
      },
      deletedAt: new Date('2026-04-18T01:00:00.000Z'),
      favorite: false,
      id: 'record-1',
      personalTags: [],
      rating: null,
      review: '',
      shortReview: '',
      status: WorkStatus.planned,
      syncStatus: WorkSyncStatus.synced,
      userId: 'user-1',
    } as never);

    await service.updateActiveForUser(
      'user-1',
      'record-1',
      {
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
      },
      undefined,
      {
        includeDeletedResult: true,
      },
    );

    expect(prisma.userWorkRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          id: 'record-1',
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.userWorkRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'record-1',
          userId: 'user-1',
        },
      }),
    );
  });

  it('rejects owner-scoped mutations when updateMany does not match the user record', async () => {
    prisma.userWorkRecord.updateMany.mockImplementation(async () => ({
      count: 0,
    }));

    await expect(
      service.updateActiveForUser('user-1', 'foreign-record', {
        favorite: true,
      }),
    ).rejects.toThrow('User record with id "foreign-record" was not found.');

    expect(prisma.userWorkRecord.findFirst).not.toHaveBeenCalled();
  });

  it('guards version-scoped updates on the previously read serverVersion', async () => {
    prisma.userWorkRecord.updateMany.mockImplementation(async () => ({
      count: 1,
    }));
    prisma.userWorkRecord.findFirst.mockResolvedValue({
      id: 'record-1',
      serverVersion: 4,
      userId: 'user-1',
    } as never);

    await expect(
      service.updateWithVersionGuard('record-1', 'user-1', 3, {
        favorite: true,
        serverVersion: {
          increment: 1,
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'record-1',
        serverVersion: 4,
      }),
    );

    expect(prisma.userWorkRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'record-1',
          serverVersion: 3,
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.userWorkRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'record-1',
          userId: 'user-1',
        },
      }),
    );
  });

  it('returns null without refetching when a concurrent writer advanced the version', async () => {
    prisma.userWorkRecord.updateMany.mockImplementation(async () => ({
      count: 0,
    }));

    await expect(
      service.updateWithVersionGuard('record-1', 'user-1', 3, {
        favorite: true,
        serverVersion: {
          increment: 1,
        },
      }),
    ).resolves.toBeNull();

    expect(prisma.userWorkRecord.findFirst).not.toHaveBeenCalled();
  });
});
