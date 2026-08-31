import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type {
  ContributorRecord,
  SeriesRecord,
  SyncAutoMergeSnapshot,
  SyncEntityType,
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  SyncResultCode,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardRecord,
  TierLaneRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRecord,
  WorkRelationRecord,
  WorkSeriesLinkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { LAST_JSON_EXPORT_AT_META_KEY } from '@shared/constants/archive-metadata';
import { getWorkArchiveDb } from '../../works/storage';
import { appMetaRepository } from '../services/app-meta.repository';
import { syncQueueRepository } from '../services/sync-queue.repository';
import { LAST_SUCCESSFUL_PUSH_AT_KEY } from '../services/sync-metadata';
import {
  SYNC_STALE_STATUS_AT_KEY,
  SYNC_STALE_STATUS_REASON_KEY,
} from '../services/sync.service';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';

export interface SyncDashboardItem {
  id: string;
  entityId: string;
  entityType: SyncEntityType;
  deletedAt: string | null;
  lastError: string | null;
  linkTo: string | null;
  operation: SyncOperation;
  retryCount: number;
  serverVersion: number;
  state: 'conflict' | 'failed' | 'pending' | 'requeued';
  syncStatus: WorkSyncStatus;
  title: string;
  updatedAt: string;
  localSnapshot: SyncQueuePayload;
  conflictRemote: SyncQueuePayload | null;
  conflictMessage: string | null;
  conflictCode: SyncResultCode | null;
  autoMerge: SyncAutoMergeSnapshot | null;
  source: SyncQueueSource;
}

interface SyncDashboardState {
  activeRecordCount: number;
  conflictWorks: WorkRecord[];
  conflictItems: SyncDashboardItem[];
  failedItems: SyncDashboardItem[];
  lastJsonBackupAt: string | null;
  lastSuccessfulPullAt: string | null;
  lastSuccessfulPushAt: string | null;
  pendingItems: SyncDashboardItem[];
  queueItems: SyncQueueItemRecord[];
  staleStatusAt: string | null;
  staleStatusReason: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SyncDashboardState = {
  activeRecordCount: 0,
  conflictWorks: [],
  conflictItems: [],
  failedItems: [],
  lastJsonBackupAt: null,
  lastSuccessfulPullAt: null,
  lastSuccessfulPushAt: null,
  pendingItems: [],
  queueItems: [],
  staleStatusAt: null,
  staleStatusReason: null,
  isLoading: true,
  error: null,
};

function isDatabaseClosedError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'DatabaseClosedError' ||
      error.message.includes('Database has been closed'))
  );
}

function compareSyncDashboardItems(
  left: SyncDashboardItem,
  right: SyncDashboardItem,
) {
  const updatedAtDelta = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return right.id.localeCompare(left.id);
}

function getReleaseRecordTitle(
  releaseRecord: UserReleaseRecord | undefined,
  parentWork: WorkRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  if (parentWork) {
    return appI18n.t('sync.titleRelease', { title: parentWork.title });
  }

  const payload = queueItem.payload as UserReleaseRecord;
  const catalogReleaseId =
    releaseRecord?.catalogReleaseId ??
    payload.catalogReleaseId ??
    queueItem.entityId;

  return appI18n.t('sync.titleReleaseFallback', {
    id: catalogReleaseId.slice(0, 8),
  });
}

function getTimelineEntryTitle(
  timelineEntry: TimelineEntryRecord | undefined,
  parentWork: WorkRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  if (parentWork) {
    return appI18n.t('sync.titleTimeline', { title: parentWork.title });
  }

  const payload = queueItem.payload as TimelineEntryRecord;
  const entryId = timelineEntry?.id ?? payload.id ?? queueItem.entityId;

  return appI18n.t('sync.titleTimelineFallback', {
    id: entryId.slice(0, 8),
  });
}

function getGraphEntityTitle(
  queueItem: SyncQueueItemRecord,
  worksById: Map<string, WorkRecord>,
  seriesById: Map<string, SeriesRecord>,
  contributorsById: Map<string, ContributorRecord>,
) {
  if (queueItem.entityType === 'series') {
    const series =
      seriesById.get(queueItem.entityId) ?? (queueItem.payload as SeriesRecord);

    return appI18n.t('sync.titleSeries', { title: series.title });
  }

  if (queueItem.entityType === 'contributor') {
    const contributor =
      contributorsById.get(queueItem.entityId) ??
      (queueItem.payload as ContributorRecord);

    return appI18n.t('sync.titleContributor', { name: contributor.name });
  }

  if (queueItem.entityType === 'work_series_link') {
    const link = queueItem.payload as WorkSeriesLinkRecord;
    const work = worksById.get(link.workId);
    const series = seriesById.get(link.seriesId);

    return appI18n.t('sync.titleWorkSeriesLink', {
      series: series?.title ?? appI18n.t('sync.titleFallbackSeries'),
      work: work?.title ?? appI18n.t('sync.titleFallbackWork'),
    });
  }

  if (queueItem.entityType === 'work_contributor') {
    const link = queueItem.payload as WorkContributorRecord;
    const work = worksById.get(link.workId);
    const contributor = contributorsById.get(link.contributorId);

    return appI18n.t('sync.titleWorkContributorLink', {
      contributor:
        contributor?.name ?? appI18n.t('sync.titleFallbackContributor'),
      work: work?.title ?? appI18n.t('sync.titleFallbackWork'),
    });
  }

  const relation = queueItem.payload as WorkRelationRecord;
  const sourceWork = worksById.get(relation.sourceWorkId);
  const targetWork = worksById.get(relation.targetWorkId);

  return appI18n.t('sync.titleRelation', {
    source: sourceWork?.title ?? appI18n.t('sync.titleFallbackWork'),
    target: targetWork?.title ?? appI18n.t('sync.titleFallbackRelatedWork'),
  });
}

function getGraphSnapshot(queueItem: SyncQueueItemRecord) {
  return queueItem.payload as
    | ContributorRecord
    | SeriesRecord
    | WorkContributorRecord
    | WorkRelationRecord
    | WorkSeriesLinkRecord;
}

function getTierBoardTitle(
  tierBoard: TierBoardRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  const payload = queueItem.payload as TierBoardRecord;
  const title = tierBoard?.title ?? payload.title;

  return title
    ? appI18n.t('sync.titleTierBoard', { title })
    : appI18n.t('sync.titleTierBoardFallback', {
        id: queueItem.entityId.slice(0, 8),
      });
}

function getTierLaneTitle(
  lane: TierLaneRecord | undefined,
  board: TierBoardRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  const payload = queueItem.payload as TierLaneRecord;
  const title = lane?.title ?? payload.title;
  const boardTitle = board?.title ?? appI18n.t('sync.titleFallbackTierBoard');

  return title
    ? appI18n.t('sync.titleTierLane', { boardTitle, title })
    : appI18n.t('sync.titleTierLaneFallback', {
        boardTitle,
        id: queueItem.entityId.slice(0, 8),
      });
}

function getTierBoardCardTitle(
  card: TierBoardCardRecord | undefined,
  board: TierBoardRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  const payload = queueItem.payload as TierBoardCardRecord;
  const title = card?.title ?? payload.title;
  const boardTitle = board?.title ?? appI18n.t('sync.titleFallbackTierBoard');

  return title
    ? appI18n.t('sync.titleTierBoardCard', { boardTitle, title })
    : appI18n.t('sync.titleTierBoardCardFallback', {
        boardTitle,
        id: queueItem.entityId.slice(0, 8),
      });
}

function getTierBoardAssetTitle(
  asset: TierBoardAssetRecord | undefined,
  board: TierBoardRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  const payload = queueItem.payload as TierBoardAssetRecord;
  const name = asset?.originalName ?? payload.originalName;
  const boardTitle = board?.title ?? appI18n.t('sync.titleFallbackTierBoard');

  return name
    ? appI18n.t('sync.titleTierBoardAsset', { boardTitle, name })
    : appI18n.t('sync.titleTierBoardAssetFallback', {
        boardTitle,
        id: queueItem.entityId.slice(0, 8),
      });
}

function getQueueItemState(
  syncStatus: WorkSyncStatus,
  queueItem: SyncQueueItemRecord,
): SyncDashboardItem['state'] {
  if (syncStatus === 'conflict' || queueItem.conflict) {
    return 'conflict';
  }

  if (queueItem.autoMerge?.status === 'requeued') {
    return 'requeued';
  }

  return queueItem.lastError ? 'failed' : 'pending';
}

function buildSyncDashboardItem(
  queueItem: SyncQueueItemRecord,
  worksById: Map<string, WorkRecord>,
  releaseRecordsById: Map<string, UserReleaseRecord>,
  timelineEntriesById: Map<string, TimelineEntryRecord>,
  seriesById: Map<string, SeriesRecord>,
  contributorsById: Map<string, ContributorRecord>,
  tierBoardsById: Map<string, TierBoardRecord>,
  tierLanesById: Map<string, TierLaneRecord>,
  tierBoardCardsById: Map<string, TierBoardCardRecord>,
  tierBoardAssetsById: Map<string, TierBoardAssetRecord>,
): SyncDashboardItem {
  if (queueItem.entityType === 'work') {
    const work =
      worksById.get(queueItem.entityId) ?? (queueItem.payload as WorkRecord);
    const syncStatus = work.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'work',
      deletedAt: work.deletedAt,
      lastError: queueItem.lastError,
      linkTo: `/works/${queueItem.entityId}`,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: work.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: work.title,
      updatedAt: work.updatedAt,
      localSnapshot: work,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'timeline_entry') {
    const timelineEntry =
      timelineEntriesById.get(queueItem.entityId) ??
      (queueItem.payload as TimelineEntryRecord);
    const parentWork = worksById.get(timelineEntry.workId);
    const syncStatus = timelineEntry.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'timeline_entry',
      deletedAt: timelineEntry.deletedAt,
      lastError: queueItem.lastError,
      linkTo: parentWork ? `/works/${parentWork.id}` : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: timelineEntry.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getTimelineEntryTitle(timelineEntry, parentWork, queueItem),
      updatedAt: timelineEntry.updatedAt,
      localSnapshot: timelineEntry,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (
    queueItem.entityType === 'series' ||
    queueItem.entityType === 'contributor' ||
    queueItem.entityType === 'work_series_link' ||
    queueItem.entityType === 'work_contributor' ||
    queueItem.entityType === 'work_relation'
  ) {
    const snapshot = getGraphSnapshot(queueItem);
    const syncStatus = snapshot.syncStatus;
    const workId =
      'workId' in snapshot
        ? snapshot.workId
        : 'sourceWorkId' in snapshot
          ? snapshot.sourceWorkId
          : null;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: queueItem.entityType,
      deletedAt: snapshot.deletedAt,
      lastError: queueItem.lastError,
      linkTo: workId ? `/works/${workId}` : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: snapshot.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getGraphEntityTitle(
        queueItem,
        worksById,
        seriesById,
        contributorsById,
      ),
      updatedAt: snapshot.updatedAt,
      localSnapshot: snapshot,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'tier_board') {
    const tierBoard =
      tierBoardsById.get(queueItem.entityId) ??
      (queueItem.payload as TierBoardRecord);
    const syncStatus = tierBoard.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'tier_board',
      deletedAt: tierBoard.deletedAt,
      lastError: queueItem.lastError,
      linkTo: `/tier-boards/${tierBoard.id}`,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: tierBoard.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getTierBoardTitle(tierBoard, queueItem),
      updatedAt: tierBoard.updatedAt,
      localSnapshot: tierBoard,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'tier_lane') {
    const tierLane =
      tierLanesById.get(queueItem.entityId) ??
      (queueItem.payload as TierLaneRecord);
    const parentBoard = tierBoardsById.get(tierLane.boardId);
    const syncStatus = tierLane.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'tier_lane',
      deletedAt: tierLane.deletedAt,
      lastError: queueItem.lastError,
      linkTo: tierLane.boardId ? `/tier-boards/${tierLane.boardId}` : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: tierLane.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getTierLaneTitle(tierLane, parentBoard, queueItem),
      updatedAt: tierLane.updatedAt,
      localSnapshot: tierLane,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'tier_board_card') {
    const tierBoardCard =
      tierBoardCardsById.get(queueItem.entityId) ??
      (queueItem.payload as TierBoardCardRecord);
    const parentBoard = tierBoardsById.get(tierBoardCard.boardId);
    const syncStatus = tierBoardCard.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'tier_board_card',
      deletedAt: tierBoardCard.deletedAt,
      lastError: queueItem.lastError,
      linkTo: tierBoardCard.boardId
        ? `/tier-boards/${tierBoardCard.boardId}`
        : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: tierBoardCard.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getTierBoardCardTitle(tierBoardCard, parentBoard, queueItem),
      updatedAt: tierBoardCard.updatedAt,
      localSnapshot: tierBoardCard,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'tier_board_asset') {
    const tierBoardAsset =
      tierBoardAssetsById.get(queueItem.entityId) ??
      (queueItem.payload as TierBoardAssetRecord);
    const parentBoard = tierBoardsById.get(tierBoardAsset.boardId);
    const syncStatus: WorkSyncStatus = queueItem.conflict
      ? 'conflict'
      : 'pending';

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'tier_board_asset',
      deletedAt: tierBoardAsset.deletedAt,
      lastError: queueItem.lastError,
      linkTo: tierBoardAsset.boardId
        ? `/tier-boards/${tierBoardAsset.boardId}`
        : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: tierBoardAsset.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getTierBoardAssetTitle(tierBoardAsset, parentBoard, queueItem),
      updatedAt: tierBoardAsset.updatedAt,
      localSnapshot: tierBoardAsset,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  if (queueItem.entityType === 'release_record') {
    const releaseRecord =
      releaseRecordsById.get(queueItem.entityId) ??
      (queueItem.payload as UserReleaseRecord);
    const parentWork = worksById.get(releaseRecord.userWorkRecordId);
    const syncStatus = releaseRecord.syncStatus;

    return {
      id: queueItem.id,
      entityId: queueItem.entityId,
      entityType: 'release_record',
      deletedAt: releaseRecord.deletedAt,
      lastError: queueItem.lastError,
      linkTo: parentWork ? `/works/${parentWork.id}` : null,
      operation: queueItem.operation,
      retryCount: queueItem.retryCount,
      serverVersion: releaseRecord.serverVersion,
      state: getQueueItemState(syncStatus, queueItem),
      syncStatus,
      title: getReleaseRecordTitle(releaseRecord, parentWork, queueItem),
      updatedAt: releaseRecord.updatedAt,
      localSnapshot: releaseRecord,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
      autoMerge: queueItem.autoMerge ?? null,
      source: queueItem.source ?? 'unknown',
    };
  }

  const snapshot = queueItem.payload as SyncQueuePayload & {
    deletedAt?: string | null;
    serverVersion?: number;
    syncStatus?: WorkSyncStatus;
    updatedAt?: string;
  };
  const syncStatus = snapshot.syncStatus ?? 'pending';

  return {
    id: queueItem.id,
    entityId: queueItem.entityId,
    entityType: queueItem.entityType,
    deletedAt: snapshot.deletedAt ?? null,
    lastError: queueItem.lastError,
    linkTo: null,
    operation: queueItem.operation,
    retryCount: queueItem.retryCount,
    serverVersion: snapshot.serverVersion ?? 0,
    state: getQueueItemState(syncStatus, queueItem),
    syncStatus,
    title: appI18n.t('sync.titleGeneric', {
      id: queueItem.entityId.slice(0, 8),
    }),
    updatedAt: snapshot.updatedAt ?? queueItem.createdAt,
    localSnapshot: queueItem.payload,
    conflictRemote: queueItem.conflict?.remote ?? null,
    conflictMessage: queueItem.conflict?.message ?? null,
    conflictCode: queueItem.conflict?.code ?? null,
    autoMerge: queueItem.autoMerge ?? null,
    source: queueItem.source ?? 'unknown',
  };
}

export function useSyncDashboard() {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<SyncDashboardState>(initialState);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      try {
        const db = getWorkArchiveDb();
        const [
          queueItems,
          works,
          releaseRecords,
          timelineEntries,
          series,
          contributors,
          tierBoards,
          tierLanes,
          tierBoardCards,
          tierBoardAssets,
          activeRecordCount,
          lastJsonBackupAt,
          lastSuccessfulPullAt,
          lastSuccessfulPushAt,
          staleStatusAt,
          staleStatusReason,
        ] = await Promise.all([
          syncQueueRepository.listAll(),
          db.works.toArray(),
          db.releaseRecords.toArray(),
          db.timelineEntries.toArray(),
          db.series.toArray(),
          db.contributors.toArray(),
          db.tierBoards.toArray(),
          db.tierLanes.toArray(),
          db.tierBoardCards.toArray(),
          db.tierBoardAssets.toArray(),
          db.works.filter((work) => work.deletedAt === null).count(),
          appMetaRepository.getValue(LAST_JSON_EXPORT_AT_META_KEY),
          appMetaRepository.getValue(LAST_SUCCESSFUL_PULL_AT_KEY),
          appMetaRepository.getValue(LAST_SUCCESSFUL_PUSH_AT_KEY),
          appMetaRepository.getValue(SYNC_STALE_STATUS_AT_KEY),
          appMetaRepository.getValue(SYNC_STALE_STATUS_REASON_KEY),
        ]);
        const worksById = new Map(works.map((work) => [work.id, work]));
        const releaseRecordsById = new Map(
          releaseRecords.map((releaseRecord) => [
            releaseRecord.id,
            releaseRecord,
          ]),
        );
        const timelineEntriesById = new Map(
          timelineEntries.map((entry) => [entry.id, entry]),
        );
        const seriesById = new Map(series.map((entry) => [entry.id, entry]));
        const contributorsById = new Map(
          contributors.map((entry) => [entry.id, entry]),
        );
        const tierBoardsById = new Map(
          tierBoards.map((entry) => [entry.id, entry]),
        );
        const tierLanesById = new Map(
          tierLanes.map((entry) => [entry.id, entry]),
        );
        const tierBoardCardsById = new Map(
          tierBoardCards.map((entry) => [entry.id, entry]),
        );
        const tierBoardAssetsById = new Map(
          tierBoardAssets.map((entry) => [entry.id, entry]),
        );
        const dashboardItems = queueItems
          .map((queueItem) =>
            buildSyncDashboardItem(
              queueItem,
              worksById,
              releaseRecordsById,
              timelineEntriesById,
              seriesById,
              contributorsById,
              tierBoardsById,
              tierLanesById,
              tierBoardCardsById,
              tierBoardAssetsById,
            ),
          )
          .sort(compareSyncDashboardItems);

        return {
          activeRecordCount,
          conflictWorks: works.filter((work) => work.syncStatus === 'conflict'),
          conflictItems: dashboardItems.filter(
            (item) => item.state === 'conflict',
          ),
          failedItems: dashboardItems.filter((item) => item.state === 'failed'),
          lastJsonBackupAt,
          lastSuccessfulPullAt,
          lastSuccessfulPushAt,
          pendingItems: dashboardItems.filter(
            (item) => item.state === 'pending' || item.state === 'requeued',
          ),
          queueItems,
          staleStatusAt,
          staleStatusReason,
        };
      } catch (error) {
        if (isDatabaseClosedError(error)) {
          return {
            activeRecordCount: 0,
            conflictWorks: [],
            conflictItems: [],
            failedItems: [],
            lastJsonBackupAt: null,
            lastSuccessfulPullAt: null,
            lastSuccessfulPushAt: null,
            pendingItems: [],
            queueItems: [],
            staleStatusAt: null,
            staleStatusReason: null,
          };
        }

        throw error;
      }
    }).subscribe({
      next: ({
        activeRecordCount,
        conflictWorks,
        conflictItems,
        failedItems,
        lastJsonBackupAt,
        lastSuccessfulPullAt,
        lastSuccessfulPushAt,
        pendingItems,
        queueItems,
        staleStatusAt,
        staleStatusReason,
      }) => {
        setState({
          activeRecordCount,
          conflictWorks,
          conflictItems,
          failedItems,
          lastJsonBackupAt,
          lastSuccessfulPullAt,
          lastSuccessfulPushAt,
          pendingItems,
          queueItems,
          staleStatusAt,
          staleStatusReason,
          isLoading: false,
          error: null,
        });
      },
      error: (error) => {
        setState({
          activeRecordCount: 0,
          conflictWorks: [],
          conflictItems: [],
          failedItems: [],
          lastJsonBackupAt: null,
          lastSuccessfulPullAt: null,
          lastSuccessfulPushAt: null,
          pendingItems: [],
          queueItems: [],
          staleStatusAt: null,
          staleStatusReason: null,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : appI18n.t('sync.dashboardLoadError'),
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  return state;
}
