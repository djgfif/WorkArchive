import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type {
  ContributorRecord,
  SeriesRecord,
  SyncEntityType,
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  SyncResultCode,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRecord,
  WorkRelationRecord,
  WorkSeriesLinkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { getWorkArchiveDb } from '../../works/db/work-archive.db';
import { appMetaRepository } from '../services/app-meta.repository';
import { syncQueueRepository } from '../services/sync-queue.repository';

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
  state: 'conflict' | 'failed' | 'pending';
  syncStatus: WorkSyncStatus;
  title: string;
  updatedAt: string;
  localSnapshot: SyncQueuePayload;
  conflictRemote: SyncQueuePayload | null;
  conflictMessage: string | null;
  conflictCode: SyncResultCode | null;
  source: SyncQueueSource;
}

interface SyncDashboardState {
  conflictWorks: WorkRecord[];
  conflictItems: SyncDashboardItem[];
  failedItems: SyncDashboardItem[];
  lastSuccessfulPullAt: string | null;
  pendingItems: SyncDashboardItem[];
  queueItems: SyncQueueItemRecord[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SyncDashboardState = {
  conflictWorks: [],
  conflictItems: [],
  failedItems: [],
  lastSuccessfulPullAt: null,
  pendingItems: [],
  queueItems: [],
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
    return `${parentWork.title} · 권별 기록`;
  }

  const payload = queueItem.payload as UserReleaseRecord;
  const catalogReleaseId =
    releaseRecord?.catalogReleaseId ??
    payload.catalogReleaseId ??
    queueItem.entityId;

  return `권별 기록 ${catalogReleaseId.slice(0, 8)}`;
}

function getTimelineEntryTitle(
  timelineEntry: TimelineEntryRecord | undefined,
  parentWork: WorkRecord | undefined,
  queueItem: SyncQueueItemRecord,
) {
  if (parentWork) {
    return `${parentWork.title} · 타임라인 기록`;
  }

  const payload = queueItem.payload as TimelineEntryRecord;
  const entryId = timelineEntry?.id ?? payload.id ?? queueItem.entityId;

  return `타임라인 기록 ${entryId.slice(0, 8)}`;
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

    return `${series.title} · 시리즈`;
  }

  if (queueItem.entityType === 'contributor') {
    const contributor =
      contributorsById.get(queueItem.entityId) ??
      (queueItem.payload as ContributorRecord);

    return `${contributor.name} · 제작진`;
  }

  if (queueItem.entityType === 'work_series_link') {
    const link = queueItem.payload as WorkSeriesLinkRecord;
    const work = worksById.get(link.workId);
    const series = seriesById.get(link.seriesId);

    return `${work?.title ?? '작품'} · ${series?.title ?? '시리즈'} 연결`;
  }

  if (queueItem.entityType === 'work_contributor') {
    const link = queueItem.payload as WorkContributorRecord;
    const work = worksById.get(link.workId);
    const contributor = contributorsById.get(link.contributorId);

    return `${work?.title ?? '작품'} · ${contributor?.name ?? '제작진'} 연결`;
  }

  const relation = queueItem.payload as WorkRelationRecord;
  const sourceWork = worksById.get(relation.sourceWorkId);
  const targetWork = worksById.get(relation.targetWorkId);

  return `${sourceWork?.title ?? '작품'} · ${targetWork?.title ?? '관련 작품'}`;
}

function getGraphSnapshot(queueItem: SyncQueueItemRecord) {
  return queueItem.payload as
    | ContributorRecord
    | SeriesRecord
    | WorkContributorRecord
    | WorkRelationRecord
    | WorkSeriesLinkRecord;
}

function buildSyncDashboardItem(
  queueItem: SyncQueueItemRecord,
  worksById: Map<string, WorkRecord>,
  releaseRecordsById: Map<string, UserReleaseRecord>,
  timelineEntriesById: Map<string, TimelineEntryRecord>,
  seriesById: Map<string, SeriesRecord>,
  contributorsById: Map<string, ContributorRecord>,
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
      state:
        syncStatus === 'conflict'
          ? 'conflict'
          : queueItem.lastError
            ? 'failed'
            : 'pending',
      syncStatus,
      title: work.title,
      updatedAt: work.updatedAt,
      localSnapshot: work,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
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
      state:
        syncStatus === 'conflict'
          ? 'conflict'
          : queueItem.lastError
            ? 'failed'
            : 'pending',
      syncStatus,
      title: getTimelineEntryTitle(timelineEntry, parentWork, queueItem),
      updatedAt: timelineEntry.updatedAt,
      localSnapshot: timelineEntry,
      conflictRemote: queueItem.conflict?.remote ?? null,
      conflictMessage: queueItem.conflict?.message ?? null,
      conflictCode: queueItem.conflict?.code ?? null,
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
      state:
        syncStatus === 'conflict'
          ? 'conflict'
          : queueItem.lastError
            ? 'failed'
            : 'pending',
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
      source: queueItem.source ?? 'unknown',
    };
  }

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
    state:
      syncStatus === 'conflict'
        ? 'conflict'
        : queueItem.lastError
          ? 'failed'
          : 'pending',
    syncStatus,
    title: getReleaseRecordTitle(releaseRecord, parentWork, queueItem),
    updatedAt: releaseRecord.updatedAt,
    localSnapshot: releaseRecord,
    conflictRemote: queueItem.conflict?.remote ?? null,
    conflictMessage: queueItem.conflict?.message ?? null,
    conflictCode: queueItem.conflict?.code ?? null,
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
          lastSuccessfulPullAt,
        ] = await Promise.all([
          syncQueueRepository.listAll(),
          db.works.toArray(),
          db.releaseRecords.toArray(),
          db.timelineEntries.toArray(),
          db.series.toArray(),
          db.contributors.toArray(),
          appMetaRepository.getValue(LAST_SUCCESSFUL_PULL_AT_KEY),
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
        const dashboardItems = queueItems
          .map((queueItem) =>
            buildSyncDashboardItem(
              queueItem,
              worksById,
              releaseRecordsById,
              timelineEntriesById,
              seriesById,
              contributorsById,
            ),
          )
          .sort(compareSyncDashboardItems);

        return {
          conflictWorks: works.filter((work) => work.syncStatus === 'conflict'),
          conflictItems: dashboardItems.filter(
            (item) => item.state === 'conflict',
          ),
          failedItems: dashboardItems.filter((item) => item.state === 'failed'),
          lastSuccessfulPullAt,
          pendingItems: dashboardItems.filter(
            (item) => item.state === 'pending',
          ),
          queueItems,
        };
      } catch (error) {
        if (isDatabaseClosedError(error)) {
          return {
            conflictWorks: [],
            conflictItems: [],
            failedItems: [],
            lastSuccessfulPullAt: null,
            pendingItems: [],
            queueItems: [],
          };
        }

        throw error;
      }
    }).subscribe({
      next: ({
        conflictWorks,
        conflictItems,
        failedItems,
        lastSuccessfulPullAt,
        pendingItems,
        queueItems,
      }) => {
        setState({
          conflictWorks,
          conflictItems,
          failedItems,
          lastSuccessfulPullAt,
          pendingItems,
          queueItems,
          isLoading: false,
          error: null,
        });
      },
      error: (error) => {
        setState({
          conflictWorks: [],
          conflictItems: [],
          failedItems: [],
          lastSuccessfulPullAt: null,
          pendingItems: [],
          queueItems: [],
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : '동기화 정보를 불러오지 못했습니다.',
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  return state;
}
