import { NotFoundException } from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UserReleaseRecordsService } from '../src/modules/user-records/user-release-records.service';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('UserReleaseRecordsService', () => {
  let service: UserReleaseRecordsService;
  let prisma: {
    userReleaseRecord: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const existingReleaseRecord = {
    catalogRelease: {
      id: 'catalog-release-1',
    },
    catalogReleaseId: 'catalog-release-1',
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    favorite: false,
    id: 'release-record-1',
    rating: 4,
    review: '',
    serverVersion: 1,
    shortReview: 'solid volume',
    status: WorkStatus.completed,
    syncStatus: WorkSyncStatus.synced,
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    userWorkRecord: {
      catalogTitle: {
        mediumType: WorkType.novel,
      },
      catalogTitleId: 'catalog-title-1',
      catalogWork: {
        type: WorkType.novel,
      },
      id: 'record-1',
      userId: 'user-1',
    },
    userWorkRecordId: 'record-1',
  };

  beforeEach(() => {
    prisma = {
      userReleaseRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new UserReleaseRecordsService(
      prisma as unknown as PrismaService,
    );
  });

  it('updates release records only after an owner-scoped lookup', async () => {
    prisma.userReleaseRecord.findFirst.mockResolvedValue(
      existingReleaseRecord as never,
    );
    prisma.userReleaseRecord.update.mockResolvedValue({
      ...existingReleaseRecord,
      favorite: true,
      serverVersion: 2,
    } as never);

    await expect(
      service.updateForUser('release-record-1', 'user-1', {
        favorite: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        favorite: true,
        id: 'release-record-1',
        serverVersion: 2,
      }),
    );

    expect(prisma.userReleaseRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'release-record-1',
          userWorkRecord: {
            userId: 'user-1',
          },
        },
      }),
    );
    expect(prisma.userReleaseRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'release-record-1',
        },
      }),
    );
  });

  it.each([
    [
      'update',
      () => service.updateForUser('foreign-release-record', 'user-1', {}),
    ],
    [
      'delete',
      () => service.softDeleteForUser('foreign-release-record', 'user-1'),
    ],
    ['restore', () => service.restoreForUser('foreign-release-record', 'user-1')],
  ])(
    'rejects %s when the release record is not owned by the current user',
    async (_operation, action) => {
      prisma.userReleaseRecord.findFirst.mockResolvedValue(null as never);

      await expect(action()).rejects.toThrow(NotFoundException);

      expect(prisma.userReleaseRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'foreign-release-record',
            userWorkRecord: {
              userId: 'user-1',
            },
          },
        }),
      );
      expect(prisma.userReleaseRecord.update).not.toHaveBeenCalled();
    },
  );

  it('soft-deletes release records with a sync version increment', async () => {
    prisma.userReleaseRecord.findFirst.mockResolvedValue(
      existingReleaseRecord as never,
    );
    prisma.userReleaseRecord.update.mockResolvedValue({
      ...existingReleaseRecord,
      deletedAt: new Date('2026-04-18T01:00:00.000Z'),
      serverVersion: 2,
    } as never);

    await service.softDeleteForUser('release-record-1', 'user-1');

    expect(prisma.userReleaseRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          serverVersion: {
            increment: 1,
          },
          syncStatus: WorkSyncStatus.synced,
        }),
      }),
    );
  });

  it('restores release records with a sync version increment', async () => {
    prisma.userReleaseRecord.findFirst.mockResolvedValue({
      ...existingReleaseRecord,
      deletedAt: new Date('2026-04-18T01:00:00.000Z'),
    } as never);
    prisma.userReleaseRecord.update.mockResolvedValue({
      ...existingReleaseRecord,
      deletedAt: null,
      serverVersion: 2,
    } as never);

    await service.restoreForUser('release-record-1', 'user-1');

    expect(prisma.userReleaseRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          deletedAt: null,
          serverVersion: {
            increment: 1,
          },
          syncStatus: WorkSyncStatus.synced,
        },
      }),
    );
  });
});
