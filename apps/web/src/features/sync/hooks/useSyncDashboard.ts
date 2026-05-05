import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type {
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  SyncResultCode,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
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
  entityType: 'release_record' | 'timeline_entry' | 'work';
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

function buildSyncDashboardItem(
  queueItem: SyncQueueItemRecord,
  worksById: Map<string, WorkRecord>,
  releaseRecordsById: Map<string, UserReleaseRecord>,
  timelineEntriesById: Map<string, TimelineEntryRecord>,
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
          lastSuccessfulPullAt,
        ] = await Promise.all([
          syncQueueRepository.listAll(),
          db.works.toArray(),
          db.releaseRecords.toArray(),
          db.timelineEntries.toArray(),
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
        const dashboardItems = queueItems
          .map((queueItem) =>
            buildSyncDashboardItem(
              queueItem,
              worksById,
              releaseRecordsById,
              timelineEntriesById,
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
