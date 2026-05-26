import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { WorkSyncStatus } from '@prisma/client';
import type { Prisma, UserContributor, UserSeries } from '@prisma/client';

import { MetricsService } from '../../../observability/metrics.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PullSyncDto } from '../dto/pull-sync.dto';
import type { PullSyncResponseDto } from '../dto/pull-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  toUserReleaseRecordResponse,
  USER_RELEASE_RECORD_INCLUDE,
  type UserReleaseRecordAggregate,
} from '../../user-records/user-release-records.service';
import {
  toUserTimelineEntryResponse,
  USER_TIMELINE_ENTRY_INCLUDE,
  type UserTimelineEntryAggregate,
} from '../../user-records/user-timeline-entries.service';
import type { WorkAggregate } from '../../user-records/user-records.service';
import { WORK_AGGREGATE_INCLUDE } from '../../user-records/user-records.types';
import { toFlatWorkResponse } from '../../works/work-aggregate';
import {
  type OrderedPullChange,
  type PullCursor,
} from '../sync-internal.types';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';
import { SyncCursorService } from './sync-cursor.service';

const SERVER_SYNC_STATUS = WorkSyncStatus.synced;

const USER_WORK_SERIES_LINK_INCLUDE = {
  userSeries: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkSeriesLinkInclude;

const USER_WORK_CONTRIBUTOR_INCLUDE = {
  userContributor: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkContributorInclude;

const USER_WORK_RELATION_INCLUDE = {
  sourceWork: {
    select: {
      id: true,
      userId: true,
    },
  },
  targetWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkRelationInclude;

type UserSeriesSyncView = UserSeries;
type UserContributorSyncView = UserContributor;
type UserWorkSeriesLinkSyncView = Prisma.UserWorkSeriesLinkGetPayload<{
  include: typeof USER_WORK_SERIES_LINK_INCLUDE;
}>;
type UserWorkContributorSyncView = Prisma.UserWorkContributorGetPayload<{
  include: typeof USER_WORK_CONTRIBUTOR_INCLUDE;
}>;
type UserWorkRelationSyncView = Prisma.UserWorkRelationGetPayload<{
  include: typeof USER_WORK_RELATION_INCLUDE;
}>;
type StructuredLogFields = {
  count?: number;
  durationMs?: number;
  entityType?: string;
  errorCode?: string | undefined;
  provider?: string;
  requestId?: string | undefined;
  userId?: string;
};

@Injectable()
export class SyncPullService {
  private readonly logger = new Logger(SyncPullService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SyncCursorService)
    private readonly cursorService: SyncCursorService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  async pull(
    userId: string,
    pullSyncDto: PullSyncDto,
    requestId?: string,
  ): Promise<PullSyncResponseDto> {
    this.assertSupportedSchemaVersion(pullSyncDto);

    const { since } = pullSyncDto;
    const startedAt = Date.now();

    this.logEvent('sync.pull.started', {
      requestId,
      userId,
    });

    try {
      const parsedSince =
        since === undefined || since === null
          ? null
          : this.parseIsoDate(since, 'since');
      const parsedCursor = this.cursorService.parsePullCursor(
        pullSyncDto.cursor ?? null,
      );
      const pageLimit = this.cursorService.resolvePullLimit(pullSyncDto.limit);
      const queryLimit = pageLimit + 1;
      const works = await this.findWorkRecordsForPullPage(
        userId,
        parsedSince,
        parsedCursor,
        queryLimit,
      );
      const releaseRecords = await this.findReleaseRecordsForPullPage(
        userId,
        parsedSince,
        parsedCursor,
        queryLimit,
      );
      const timelineEntries = await this.findTimelineEntriesForPullPage(
        userId,
        parsedSince,
        parsedCursor,
        queryLimit,
      );
      const graphRecords = await this.findGraphRecordsForPullPage(
        userId,
        parsedSince,
        parsedCursor,
        queryLimit,
      );
      const tierBoardRecords = await this.findTierBoardRecordsForPullPage(
        userId,
        parsedSince,
        parsedCursor,
        queryLimit,
      );
      const pulledAt = new Date().toISOString();
      const orderedChanges = this.buildOrderedPullChanges({
        ...graphRecords,
        ...tierBoardRecords,
        releaseRecords,
        timelineEntries,
        works,
      });
      const pagedChanges = orderedChanges.slice(0, pageLimit);
      const hasMore = orderedChanges.length > pagedChanges.length;
      const lastPagedChange = pagedChanges.at(-1) ?? null;
      const changes = pagedChanges.map((entry) => entry.change);
      const changedRecords = [
        ...works,
        ...releaseRecords,
        ...timelineEntries,
        ...graphRecords.series,
        ...graphRecords.contributors,
        ...graphRecords.workSeriesLinks,
        ...graphRecords.workContributors,
        ...graphRecords.workRelations,
        ...tierBoardRecords.tierBoards,
        ...tierBoardRecords.tierLanes,
        ...tierBoardRecords.tierBoardCards,
        ...tierBoardRecords.tierBoardAssets,
      ].sort(
        (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
      );
      const response: PullSyncResponseDto = {
        schemaVersion: SYNC_SCHEMA_VERSION,
        pulledAt,
        nextSince: hasMore
          ? (since ?? pulledAt)
          : this.cursorService.buildNextSince(
              since ?? null,
              pulledAt,
              changedRecords,
            ),
        nextCursor:
          hasMore && lastPagedChange
            ? this.cursorService.encodePullCursor(lastPagedChange.cursor)
            : null,
        hasMore,
        changes,
      };

      this.logPullSummary(userId, since ?? null, response);
      this.metricsService?.recordSync('pull', 'success');
      this.logEvent('sync.pull.completed', {
        count: response.changes.length,
        durationMs: Date.now() - startedAt,
        requestId,
        userId,
      });

      return response;
    } catch (error) {
      this.metricsService?.recordSync('pull', 'failure');
      this.logEvent('sync.pull.failed', {
        durationMs: Date.now() - startedAt,
        errorCode: this.describeError(error),
        requestId,
        userId,
      });
      this.logger.warn(
        `Sync pull failed userId=${userId} since=${since ?? 'null'} reason=${this.describeError(error)}`,
      );
      throw error;
    }
  }

  private findWorkRecordsForPullPage(
    userId: string,
    since: Date | null,
    cursor: PullCursor | null,
    take: number,
  ) {
    return this.prisma.userWorkRecord.findMany({
      where: {
        userId,
        ...this.cursorService.findPullPageCursorFilter('work', since, cursor),
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private findReleaseRecordsForPullPage(
    userId: string,
    since: Date | null,
    cursor: PullCursor | null,
    take: number,
  ) {
    return this.prisma.userReleaseRecord.findMany({
      where: {
        userWorkRecord: {
          userId,
        },
        ...this.cursorService.findPullPageCursorFilter(
          'release_record',
          since,
          cursor,
        ),
      },
      include: USER_RELEASE_RECORD_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private findTimelineEntriesForPullPage(
    userId: string,
    since: Date | null,
    cursor: PullCursor | null,
    take: number,
  ) {
    return this.prisma.userTimelineEntry.findMany({
      where: {
        userId,
        ...this.cursorService.findPullPageCursorFilter(
          'timeline_entry',
          since,
          cursor,
        ),
      },
      include: USER_TIMELINE_ENTRY_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private async findGraphRecordsForPullPage(
    userId: string,
    since: Date | null,
    cursor: PullCursor | null,
    take: number,
  ) {
    const [
      series,
      contributors,
      workSeriesLinks,
      workContributors,
      workRelations,
    ] = await Promise.all([
      this.prisma.userSeries.findMany({
        where: {
          userId,
          ...this.cursorService.findPullPageCursorFilter(
            'series',
            since,
            cursor,
          ),
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.userContributor.findMany({
        where: {
          userId,
          ...this.cursorService.findPullPageCursorFilter(
            'contributor',
            since,
            cursor,
          ),
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.userWorkSeriesLink.findMany({
        where: {
          userWork: {
            userId,
          },
          ...this.cursorService.findPullPageCursorFilter(
            'work_series_link',
            since,
            cursor,
          ),
        },
        include: USER_WORK_SERIES_LINK_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.userWorkContributor.findMany({
        where: {
          userWork: {
            userId,
          },
          ...this.cursorService.findPullPageCursorFilter(
            'work_contributor',
            since,
            cursor,
          ),
        },
        include: USER_WORK_CONTRIBUTOR_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.userWorkRelation.findMany({
        where: {
          userId,
          ...this.cursorService.findPullPageCursorFilter(
            'work_relation',
            since,
            cursor,
          ),
        },
        include: USER_WORK_RELATION_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take,
      }),
    ]);

    return {
      contributors,
      series,
      workContributors,
      workRelations,
      workSeriesLinks,
    };
  }

  private async findTierBoardRecordsForPullPage(
    userId: string,
    since: Date | null,
    cursor: PullCursor | null,
    take: number,
  ) {
    const [tierBoards, tierLanes, tierBoardCards, tierBoardAssets] =
      await Promise.all([
        this.prisma.userTierBoard.findMany({
          where: {
            userId,
            ...this.cursorService.findPullPageCursorFilter(
              'tier_board',
              since,
              cursor,
            ),
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take,
        }),
        this.prisma.userTierLane.findMany({
          where: {
            board: { userId },
            ...this.cursorService.findPullPageCursorFilter(
              'tier_lane',
              since,
              cursor,
            ),
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take,
        }),
        this.prisma.userTierBoardCard.findMany({
          where: {
            board: { userId },
            ...this.cursorService.findPullPageCursorFilter(
              'tier_board_card',
              since,
              cursor,
            ),
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take,
        }),
        this.prisma.userTierBoardAsset.findMany({
          where: {
            board: { userId },
            ...this.cursorService.findPullPageCursorFilter(
              'tier_board_asset',
              since,
              cursor,
            ),
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take,
        }),
      ]);

    return {
      tierBoardAssets,
      tierBoardCards,
      tierLanes,
      tierBoards,
    };
  }

  private buildOrderedPullChanges({
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
  }: {
    contributors: UserContributorSyncView[];
    releaseRecords: UserReleaseRecordAggregate[];
    series: UserSeriesSyncView[];
    tierBoardAssets: Array<{
      id: string;
      boardId: string;
      cardId: string | null;
      kind: string;
      storageType: string;
      objectUrl: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>;
    tierBoardCards: Array<{
      id: string;
      boardId: string;
      laneId: string | null;
      cardSourceType: string;
      title: string;
      subtitle: string;
      imageUrl: string;
      note: string;
      userWorkId: string | null;
      orderIndex: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      syncStatus: WorkSyncStatus;
      serverVersion: number;
    }>;
    tierLanes: Array<{
      id: string;
      boardId: string;
      title: string;
      description: string;
      colorToken: string;
      orderIndex: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      syncStatus: WorkSyncStatus;
      serverVersion: number;
    }>;
    tierBoards: Array<{
      id: string;
      slug: string;
      title: string;
      description: string;
      boardType: string;
      visibility: string;
      coverImageUrl: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      syncStatus: WorkSyncStatus;
      serverVersion: number;
    }>;
    timelineEntries: UserTimelineEntryAggregate[];
    workContributors: UserWorkContributorSyncView[];
    workRelations: UserWorkRelationSyncView[];
    workSeriesLinks: UserWorkSeriesLinkSyncView[];
    works: WorkAggregate[];
  }) {
    return [
      ...works.map<OrderedPullChange>((work) => {
        const updatedAt = work.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work',
            entityId: work.id,
            operation: work.deletedAt === null ? 'upsert' : 'delete',
            work: toFlatWorkResponse(work),
          },
          cursor: {
            entityId: work.id,
            entityType: 'work',
            updatedAt,
          },
          updatedAtMs: work.updatedAt.getTime(),
        };
      }),
      ...releaseRecords.map<OrderedPullChange>((releaseRecord) => {
        const updatedAt = releaseRecord.updatedAt.toISOString();

        return {
          change: {
            entityType: 'release_record',
            entityId: releaseRecord.id,
            operation: releaseRecord.deletedAt === null ? 'upsert' : 'delete',
            releaseRecord: toUserReleaseRecordResponse(releaseRecord),
          },
          cursor: {
            entityId: releaseRecord.id,
            entityType: 'release_record',
            updatedAt,
          },
          updatedAtMs: releaseRecord.updatedAt.getTime(),
        };
      }),
      ...timelineEntries.map<OrderedPullChange>((timelineEntry) => {
        const updatedAt = timelineEntry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'timeline_entry',
            entityId: timelineEntry.id,
            operation: timelineEntry.deletedAt === null ? 'upsert' : 'delete',
            timelineEntry: toUserTimelineEntryResponse(timelineEntry),
          },
          cursor: {
            entityId: timelineEntry.id,
            entityType: 'timeline_entry',
            updatedAt,
          },
          updatedAtMs: timelineEntry.updatedAt.getTime(),
        };
      }),
      ...series.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'series',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            series: this.toSyncSeriesPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'series',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...contributors.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'contributor',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            contributor: this.toSyncContributorPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'contributor',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workSeriesLinks.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_series_link',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workSeriesLink: this.toSyncWorkSeriesLinkPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_series_link',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workContributors.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_contributor',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workContributor: this.toSyncWorkContributorPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_contributor',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workRelations.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_relation',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workRelation: this.toSyncWorkRelationPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_relation',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...tierBoards.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'tier_board',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            tierBoard: this.toSyncTierBoardPayload(entry),
          },
          cursor: { entityId: entry.id, entityType: 'tier_board', updatedAt },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...tierLanes.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'tier_lane',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            tierLane: this.toSyncTierLanePayload(entry),
          },
          cursor: { entityId: entry.id, entityType: 'tier_lane', updatedAt },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...tierBoardCards.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'tier_board_card',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            tierBoardCard: this.toSyncTierBoardCardPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'tier_board_card',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...tierBoardAssets.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'tier_board_asset',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            tierBoardAsset: this.toSyncTierBoardAssetPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'tier_board_asset',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
    ].sort((left, right) => {
      const updatedAtDelta = left.updatedAtMs - right.updatedAtMs;

      if (updatedAtDelta !== 0) {
        return updatedAtDelta;
      }

      const entityTypeDelta = left.cursor.entityType.localeCompare(
        right.cursor.entityType,
      );

      if (entityTypeDelta !== 0) {
        return entityTypeDelta;
      }

      return left.cursor.entityId.localeCompare(right.cursor.entityId);
    });
  }

  private toSyncSeriesPayload(
    series: UserSeriesSyncView,
  ): SyncSeriesPayloadDto {
    return {
      id: series.id,
      title: series.title,
      normalizedTitle: series.normalizedTitle,
      aliases: series.aliases,
      kind: series.kind,
      parentId: series.parentId ?? null,
      description: series.description,
      thumbnailUrl: series.thumbnailUrl,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString(),
      deletedAt: series.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: series.serverVersion,
    };
  }

  private toSyncContributorPayload(
    contributor: UserContributorSyncView,
  ): SyncContributorPayloadDto {
    return {
      id: contributor.id,
      name: contributor.name,
      normalizedName: contributor.normalizedName,
      aliases: contributor.aliases,
      entityType: contributor.entityType,
      createdAt: contributor.createdAt.toISOString(),
      updatedAt: contributor.updatedAt.toISOString(),
      deletedAt: contributor.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: contributor.serverVersion,
    };
  }

  private toSyncWorkSeriesLinkPayload(
    link: UserWorkSeriesLinkSyncView,
  ): SyncWorkSeriesLinkPayloadDto {
    return {
      id: link.id,
      workId: link.userWorkId,
      seriesId: link.userSeriesId,
      role: link.role,
      orderIndex: link.orderIndex ?? null,
      orderLabel: link.orderLabel,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: link.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: link.serverVersion,
    };
  }

  private toSyncWorkContributorPayload(
    link: UserWorkContributorSyncView,
  ): SyncWorkContributorPayloadDto {
    return {
      id: link.id,
      workId: link.userWorkId,
      contributorId: link.userContributorId,
      role: link.role,
      displayOrder: link.displayOrder,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: link.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: link.serverVersion,
    };
  }

  private toSyncWorkRelationPayload(
    relation: UserWorkRelationSyncView,
  ): SyncWorkRelationPayloadDto {
    return {
      id: relation.id,
      sourceWorkId: relation.sourceWorkId,
      targetWorkId: relation.targetWorkId,
      relationType: relation.relationType,
      note: relation.note,
      createdAt: relation.createdAt.toISOString(),
      updatedAt: relation.updatedAt.toISOString(),
      deletedAt: relation.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: relation.serverVersion,
    };
  }

  private toSyncTierBoardPayload(board: {
    id: string;
    slug: string;
    title: string;
    description: string;
    boardType: string;
    visibility: string;
    coverImageUrl: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierBoardPayloadDto {
    return {
      id: board.id,
      title: board.title,
      description: board.description,
      slug: board.slug,
      boardType: board.boardType as SyncTierBoardPayloadDto['boardType'],
      visibility: board.visibility as SyncTierBoardPayloadDto['visibility'],
      coverImageUrl: board.coverImageUrl,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      deletedAt: board.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: board.serverVersion,
    };
  }

  private toSyncTierLanePayload(lane: {
    id: string;
    boardId: string;
    title: string;
    description: string;
    colorToken: string;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierLanePayloadDto {
    return {
      id: lane.id,
      boardId: lane.boardId,
      title: lane.title,
      description: lane.description,
      colorToken: lane.colorToken,
      orderIndex: lane.orderIndex,
      createdAt: lane.createdAt.toISOString(),
      updatedAt: lane.updatedAt.toISOString(),
      deletedAt: lane.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: lane.serverVersion,
    };
  }

  private toSyncTierBoardCardPayload(card: {
    id: string;
    boardId: string;
    laneId: string | null;
    cardSourceType: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    note: string;
    userWorkId: string | null;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierBoardCardPayloadDto {
    return {
      id: card.id,
      boardId: card.boardId,
      laneId: card.laneId,
      cardSourceType:
        card.cardSourceType as SyncTierBoardCardPayloadDto['cardSourceType'],
      title: card.title,
      subtitle: card.subtitle,
      imageUrl: card.imageUrl,
      note: card.note,
      workId: card.userWorkId,
      orderIndex: card.orderIndex,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      deletedAt: card.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: card.serverVersion,
    };
  }

  private toSyncTierBoardAssetPayload(asset: {
    id: string;
    boardId: string;
    cardId: string | null;
    kind: string;
    storageType: string;
    objectUrl: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): SyncTierBoardAssetPayloadDto {
    return {
      id: asset.id,
      boardId: asset.boardId,
      cardId: asset.cardId,
      kind: asset.kind as SyncTierBoardAssetPayloadDto['kind'],
      storageType:
        asset.storageType as SyncTierBoardAssetPayloadDto['storageType'],
      objectUrl: asset.objectUrl,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      deletedAt: asset.deletedAt?.toISOString() ?? null,
    };
  }

  private assertSupportedSchemaVersion({
    schemaVersion,
  }: {
    schemaVersion?: unknown;
  }) {
    if (schemaVersion === undefined) {
      return;
    }

    if (schemaVersion !== SYNC_SCHEMA_VERSION) {
      throw new BadRequestException(
        `Unsupported sync schema version "${String(schemaVersion)}". Supported version is ${SYNC_SCHEMA_VERSION}.`,
      );
    }
  }

  private parseIsoDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${fieldName} must be a valid ISO 8601 date string.`,
      );
    }

    return parsed;
  }

  private logEvent(event: string, fields: StructuredLogFields) {
    this.logger.log(
      JSON.stringify({
        count: fields.count ?? null,
        durationMs: fields.durationMs ?? null,
        entityType: fields.entityType ?? null,
        errorCode: fields.errorCode ?? null,
        event,
        provider: fields.provider ?? null,
        requestId: fields.requestId ?? null,
        userId: fields.userId ?? null,
      }),
    );
  }

  private logPullSummary(
    userId: string,
    since: string | null,
    response: PullSyncResponseDto,
  ) {
    const upsertCount = response.changes.filter(
      (change) => change.operation === 'upsert',
    ).length;
    const deleteCount = response.changes.filter(
      (change) => change.operation === 'delete',
    ).length;

    this.logger.log(
      `Sync pull summary userId=${userId} since=${since ?? 'null'} changes=${response.changes.length} upsert=${upsertCount} delete=${deleteCount} nextSince=${response.nextSince}`,
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.name;
    }

    return 'UnknownError';
  }
}
