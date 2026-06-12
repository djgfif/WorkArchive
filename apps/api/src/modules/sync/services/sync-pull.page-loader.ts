import type { PrismaService } from '../../../prisma/prisma.service';
import {
  USER_RELEASE_RECORD_INCLUDE,
} from '../../user-records/user-release-records.service';
import {
  USER_TIMELINE_ENTRY_INCLUDE,
} from '../../user-records/user-timeline-entries.service';
import { WORK_AGGREGATE_INCLUDE } from '../../user-records/user-records.types';
import type { PullCursor } from '../sync-internal.types';
import type { SyncEntityType } from '../sync.constants';
import {
  USER_WORK_CONTRIBUTOR_INCLUDE,
  USER_WORK_RELATION_INCLUDE,
  USER_WORK_SERIES_LINK_INCLUDE,
  type PullChangeRecords,
} from './sync-pull.records';

type PullPageCursorFilter = (
  entityType: SyncEntityType,
  since: Date | null,
  cursor: PullCursor | null,
) => object;

export type FindPullPageRecordsParams = {
  cursor: PullCursor | null;
  findPullPageCursorFilter: PullPageCursorFilter;
  prisma: PrismaService;
  since: Date | null;
  take: number;
  userId: string;
};

export async function findRecordsForPullPage({
  cursor,
  findPullPageCursorFilter,
  prisma,
  since,
  take,
  userId,
}: FindPullPageRecordsParams): Promise<PullChangeRecords> {
  const [
    works,
    releaseRecords,
    timelineEntries,
    series,
    contributors,
    workSeriesLinks,
    workContributors,
    workRelations,
    tierBoards,
    tierLanes,
    tierBoardCards,
    tierBoardAssets,
  ] = await Promise.all([
    prisma.userWorkRecord.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('work', since, cursor),
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userReleaseRecord.findMany({
      where: {
        userWorkRecord: {
          userId,
        },
        ...findPullPageCursorFilter('release_record', since, cursor),
      },
      include: USER_RELEASE_RECORD_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userTimelineEntry.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('timeline_entry', since, cursor),
      },
      include: USER_TIMELINE_ENTRY_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userSeries.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('series', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userContributor.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('contributor', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userWorkSeriesLink.findMany({
      where: {
        userWork: {
          userId,
        },
        ...findPullPageCursorFilter('work_series_link', since, cursor),
      },
      include: USER_WORK_SERIES_LINK_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userWorkContributor.findMany({
      where: {
        userWork: {
          userId,
        },
        ...findPullPageCursorFilter('work_contributor', since, cursor),
      },
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userWorkRelation.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('work_relation', since, cursor),
      },
      include: USER_WORK_RELATION_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userTierBoard.findMany({
      where: {
        userId,
        ...findPullPageCursorFilter('tier_board', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userTierLane.findMany({
      where: {
        board: { userId },
        ...findPullPageCursorFilter('tier_lane', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userTierBoardCard.findMany({
      where: {
        board: { userId },
        ...findPullPageCursorFilter('tier_board_card', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
    prisma.userTierBoardAsset.findMany({
      where: {
        board: { userId },
        ...findPullPageCursorFilter('tier_board_asset', since, cursor),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    }),
  ]);

  return {
    contributors,
    releaseRecords,
    series,
    tierBoardAssets,
    tierBoardCards,
    tierLanes,
    tierBoards,
    timelineEntries,
    workContributors,
    workRelations,
    workSeriesLinks,
    works,
  };
}
