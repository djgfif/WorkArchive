import { describe, expect, it, jest } from '@jest/globals';

import type { PrismaService } from '../src/prisma/prisma.service';
import { findRecordsForPullPage } from '../src/modules/sync/services/sync-pull.page-loader';
import type { SyncEntityType } from '../src/modules/sync/sync.constants';

const modelNames = [
  'userWorkRecord',
  'userReleaseRecord',
  'userTimelineEntry',
  'userSeries',
  'userContributor',
  'userWorkSeriesLink',
  'userWorkContributor',
  'userWorkRelation',
  'userTierBoard',
  'userTierLane',
  'userTierBoardCard',
  'userTierBoardAsset',
] as const;

function createPrismaMock() {
  const prisma = Object.fromEntries(
    modelNames.map((modelName) => [
      modelName,
      {
        findMany: jest
          .fn<() => Promise<string[]>>()
          .mockResolvedValue([`${modelName}-record`]),
      },
    ]),
  ) as unknown as PrismaService;

  return prisma;
}

describe('sync pull page loader', () => {
  it('loads every pull entity page with shared cursor filters and ordering', async () => {
    const prisma = createPrismaMock();
    const userId = 'aa93c3ab-72a1-48b9-9875-3d6232de55e1';
    const since = new Date('2026-04-18T00:00:00.000Z');
    const cursor = {
      entityId: '19f9ff5a-c5df-4d51-b6f7-9a2f40f7ac3b',
      entityType: 'work' as const,
      updatedAt: '2026-04-18T00:00:00.000Z',
    };
    const findPullPageCursorFilter = jest.fn(
      (entityType: SyncEntityType) => ({
        cursorEntityType: entityType,
      }),
    );

    const records = await findRecordsForPullPage({
      cursor,
      findPullPageCursorFilter,
      prisma,
      since,
      take: 51,
      userId,
    });

    expect(records).toEqual({
      contributors: ['userContributor-record'],
      releaseRecords: ['userReleaseRecord-record'],
      series: ['userSeries-record'],
      tierBoardAssets: ['userTierBoardAsset-record'],
      tierBoardCards: ['userTierBoardCard-record'],
      tierLanes: ['userTierLane-record'],
      tierBoards: ['userTierBoard-record'],
      timelineEntries: ['userTimelineEntry-record'],
      workContributors: ['userWorkContributor-record'],
      workRelations: ['userWorkRelation-record'],
      workSeriesLinks: ['userWorkSeriesLink-record'],
      works: ['userWorkRecord-record'],
    });
    expect(findPullPageCursorFilter.mock.calls.map(([entityType]) => entityType))
      .toEqual([
        'work',
        'release_record',
        'timeline_entry',
        'series',
        'contributor',
        'work_series_link',
        'work_contributor',
        'work_relation',
        'tier_board',
        'tier_lane',
        'tier_board_card',
        'tier_board_asset',
      ]);

    expect(prisma.userWorkRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 51,
        where: {
          cursorEntityType: 'work',
          userId,
        },
      }),
    );
    expect(prisma.userReleaseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: {
          cursorEntityType: 'release_record',
          userWorkRecord: {
            userId,
          },
        },
      }),
    );
    expect(prisma.userWorkSeriesLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: {
          cursorEntityType: 'work_series_link',
          userWork: {
            userId,
          },
        },
      }),
    );
    expect(prisma.userTierLane.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: {
          board: { userId },
          cursorEntityType: 'tier_lane',
        },
      }),
    );
  });
});
