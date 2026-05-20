import type {
  ContributorRecord,
  PullSyncResponse,
  PullSyncChange,
  PushSyncResponse,
  PushSyncResult,
  SeriesRecord,
  SyncEntityType,
  SyncQueuePayload,
  SyncQueueItemRecord,
  SyncResultCode,
  TierBoardAssetRecord,
  TierBoardItemRecord,
  TierBoardLaneRecord,
  TierBoardRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRecord,
  WorkRelationRecord,
  WorkSeriesLinkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';
import { SYNC_SCHEMA_VERSION } from '@work-archive/shared-types';

import { requestAuthenticatedApiJson } from '../../../shared/services/api-client';
import {
  worksRepository,
  type WorksRepository,
} from '../../works/services/works.repository';
import {
  releaseRecordsRepository,
  type ReleaseRecordsRepository,
} from '../../works/services/release-records.repository';
import {
  timelineEntriesRepository,
  type TimelineEntriesRepository,
} from '../../works/services/timeline-entries.repository';
import {
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';
import {
  localizeServerMessage,
  localizeSyncResultCode,
} from '../../../shared/utils/localize-message';
import {
  graphRepository,
  type GraphRepository,
} from '../../works/services/graph.repository';
import {
  tierBoardRepository,
  type TierBoardRepository,
  type StoredTierBoardAssetRecord,
} from '../../tier-boards/services/tier-board.repository';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';
const PULL_PAGE_LIMIT = 500;

const WORK_MERGE_FIELDS = [
  'title',
  'author',
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'progressCurrent',
  'progressTotal',
  'progressUnit',
  'lastConsumedLabel',
  'startedAt',
  'completedAt',
  'droppedAt',
  'lastConsumedAt',
  'genres',
  'personalTags',
  'description',
  'thumbnailUrl',
  'deletedAt',
] as const satisfies readonly (keyof WorkRecord)[];

const RELEASE_RECORD_MERGE_FIELDS = [
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'deletedAt',
] as const satisfies readonly (keyof UserReleaseRecord)[];

export type WorkConflictMergeField = (typeof WORK_MERGE_FIELDS)[number];
export type ReleaseRecordConflictMergeField =
  (typeof RELEASE_RECORD_MERGE_FIELDS)[number];
type GraphEntityRecord =
  | ContributorRecord
  | SeriesRecord
  | WorkContributorRecord
  | WorkRelationRecord
  | WorkSeriesLinkRecord;
type TierBoardEntityRecord =
  | TierBoardRecord
  | TierBoardLaneRecord
  | TierBoardItemRecord
  | TierBoardAssetRecord;

export type SyncRunState = 'idle' | 'syncing' | 'success' | 'failed';

interface PushCycleResult {
  attemptedCount: number;
  appliedCount: number;
  conflictCount: number;
  failedCount: number;
  processedAt: string | null;
  messages: string[];
  requestFailed: boolean;
}

interface PullCycleResult {
  pulledCount: number;
  appliedCount: number;
  skippedCount: number;
  pulledAt: string | null;
  nextSince: string | null;
  messages: string[];
  requestFailed: boolean;
}

export interface ManualSyncResult {
  completedAt: string;
  state: Exclude<SyncRunState, 'idle' | 'syncing'>;
  push: PushCycleResult;
  pull: PullCycleResult;
}

function isDatabaseClosedError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'DatabaseClosedError' ||
      error.message.includes('Database has been closed'))
  );
}

function cloneWorkRecord(work: WorkRecord): WorkRecord {
  return {
    ...work,
    genres: [...work.genres],
    personalTags: [...work.personalTags],
  };
}

function cloneReleaseRecord(
  releaseRecord: UserReleaseRecord,
): UserReleaseRecord {
  return {
    ...releaseRecord,
  };
}

function cloneTimelineEntry(entry: TimelineEntryRecord): TimelineEntryRecord {
  return {
    ...entry,
  };
}

function cloneGraphEntity<TPayload extends GraphEntityRecord>(
  payload: TPayload,
): TPayload {
  if ('aliases' in payload) {
    return {
      ...payload,
      aliases: [...payload.aliases],
    } as TPayload;
  }

  return {
    ...payload,
  };
}

function cloneQueuePayload<TPayload extends SyncQueuePayload>(
  payload: TPayload,
): TPayload {
  if ('genres' in payload) {
    return cloneWorkRecord(payload as WorkRecord) as TPayload;
  }

  if ('catalogReleaseId' in payload) {
    return cloneReleaseRecord(payload as UserReleaseRecord) as TPayload;
  }

  if ('occurredAt' in payload) {
    return cloneTimelineEntry(payload as TimelineEntryRecord) as TPayload;
  }

  if (
    'layout' in payload ||
    'boardId' in payload ||
    'storageType' in payload
  ) {
    return { ...payload } as TPayload;
  }

  return cloneGraphEntity(payload as GraphEntityRecord) as TPayload;
}

function getNowIso() {
  return new Date().toISOString();
}

function getLatestIso(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function getRecordChangeTime(record: { deletedAt: string | null; updatedAt: string }) {
  if (!record.deletedAt) {
    return Date.parse(record.updatedAt);
  }

  return Math.max(Date.parse(record.updatedAt), Date.parse(record.deletedAt));
}

function getNewerRecord<TRecord extends { deletedAt: string | null; updatedAt: string }>(
  local: TRecord,
  remote: TRecord,
) {
  return getRecordChangeTime(local) >= getRecordChangeTime(remote)
    ? local
    : remote;
}

function mergeUniqueValues(left: readonly string[], right: readonly string[]) {
  return Array.from(new Set([...left, ...right]));
}

function mergeWorkSnapshots(
  remote: WorkRecord,
  localPayload: WorkRecord,
): WorkRecord {
  const newer = getNewerRecord(localPayload, remote);
  const merged: WorkRecord = {
    ...cloneWorkRecord(newer),
    createdAt: remote.createdAt,
    deletedAt: newer.deletedAt,
    favorite: localPayload.favorite || remote.favorite,
    genres: mergeUniqueValues(remote.genres, localPayload.genres),
    personalTags: mergeUniqueValues(remote.personalTags, localPayload.personalTags),
    serverVersion: remote.serverVersion,
    syncStatus: 'pending',
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
  };

  return merged;
}

function mergeReleaseRecordSnapshots(
  remote: UserReleaseRecord,
  localPayload: UserReleaseRecord,
): UserReleaseRecord {
  const newer = getNewerRecord(localPayload, remote);

  return {
    ...cloneReleaseRecord(newer),
    createdAt: remote.createdAt,
    favorite: localPayload.favorite || remote.favorite,
    serverVersion: remote.serverVersion,
    syncStatus: 'pending',
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
  };
}

function mergeTimelineEntrySnapshots(
  remote: TimelineEntryRecord,
  localPayload: TimelineEntryRecord,
): TimelineEntryRecord {
  const newer = getNewerRecord(localPayload, remote);

  return {
    ...cloneTimelineEntry(newer),
    createdAt: remote.createdAt,
    serverVersion: remote.serverVersion,
    syncStatus: 'pending',
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
  };
}

function mergeGraphEntitySnapshots<TRecord extends GraphEntityRecord>(
  remote: TRecord,
  localPayload: TRecord,
): TRecord {
  const newer = getNewerRecord(localPayload, remote);

  return {
    ...cloneGraphEntity(newer),
    createdAt: remote.createdAt,
    serverVersion: remote.serverVersion,
    syncStatus: 'pending',
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
  } as TRecord;
}

function mergeTierBoardEntitySnapshots<TRecord extends TierBoardEntityRecord>(
  remote: TRecord,
  localPayload: TRecord,
): TRecord {
  const newer =
    'serverVersion' in localPayload && 'serverVersion' in remote
      ? getNewerRecord(
          localPayload as TRecord & { deletedAt: string | null; updatedAt: string },
          remote as TRecord & { deletedAt: string | null; updatedAt: string },
        )
      : localPayload;

  return {
    ...newer,
    createdAt: remote.createdAt,
    ...(remote && 'serverVersion' in remote
      ? { serverVersion: remote.serverVersion, syncStatus: 'pending' }
      : {}),
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
  } as TRecord;
}

function mergePulledWorkWithQueuedPayload(
  remote: WorkRecord,
  localPayload: WorkRecord,
): WorkRecord {
  return mergeWorkSnapshots(remote, localPayload);
}

function mergePulledReleaseRecordWithQueuedPayload(
  remote: UserReleaseRecord,
  localPayload: UserReleaseRecord,
): UserReleaseRecord {
  return mergeReleaseRecordSnapshots(remote, localPayload);
}

function mergePulledTimelineEntryWithQueuedPayload(
  remote: TimelineEntryRecord,
  localPayload: TimelineEntryRecord,
): TimelineEntryRecord {
  return mergeTimelineEntrySnapshots(remote, localPayload);
}

function isGraphEntityType(entityType: SyncEntityType) {
  return (
    entityType === 'series' ||
    entityType === 'contributor' ||
    entityType === 'work_series_link' ||
    entityType === 'work_contributor' ||
    entityType === 'work_relation'
  );
}

function isTierBoardEntityType(entityType: SyncEntityType) {
  return (
    entityType === 'tier_board' ||
    entityType === 'tier_board_lane' ||
    entityType === 'tier_board_item' ||
    entityType === 'tier_board_asset'
  );
}

function assertSupportedResponseSchemaVersion(
  schemaVersion: unknown,
  context: 'push' | 'pull',
) {
  if (schemaVersion === SYNC_SCHEMA_VERSION) {
    return;
  }

  const label = context === 'push' ? '보내기' : '가져오기';

  throw new Error(
    `${label} 응답의 동기화 계약 버전을 지원하지 않습니다. 앱을 새로고침하거나 업데이트해주세요.`,
  );
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  return requestAuthenticatedApiJson<TResponse>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    {
      missingTokenMessage: '동기화하려면 로그인해주세요.',
    },
  );
}

export class SyncService {
  constructor(
    private readonly worksRepo: WorksRepository = worksRepository,
    private readonly releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly queueRepo: SyncQueueRepository = syncQueueRepository,
    private readonly metaRepo: AppMetaRepository = appMetaRepository,
    private readonly timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
    private readonly tierBoardRepo: TierBoardRepository = tierBoardRepository,
  ) {}

  async runManualSync(): Promise<ManualSyncResult> {
    const push = await this.pushQueuedChanges();

    if (push.requestFailed) {
      return {
        completedAt: new Date().toISOString(),
        state: 'failed',
        push,
        pull: {
          pulledCount: 0,
          appliedCount: 0,
          skippedCount: 0,
          pulledAt: null,
          nextSince: null,
          messages: ['보내기에 실패해 가져오기를 건너뛰었습니다.'],
          requestFailed: true,
        },
      };
    }

    const pull = await this.pullRemoteChanges();
    const hasIssues =
      push.failedCount > 0 ||
      push.conflictCount > 0 ||
      pull.requestFailed ||
      pull.skippedCount > 0;

    return {
      completedAt: new Date().toISOString(),
      state: hasIssues ? 'failed' : 'success',
      push,
      pull,
    };
  }

  async pushQueuedChanges(): Promise<PushCycleResult> {
    const queueItems = await this.queueRepo.listAll();

    if (queueItems.length === 0) {
      return {
        attemptedCount: 0,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        processedAt: null,
        messages: ['동기화할 변경 사항이 없습니다.'],
        requestFailed: false,
      };
    }

    const queueItemIds = queueItems.map((item) => item.id);
    const queueItemsById = new Map(queueItems.map((item) => [item.id, item]));

    try {
      const response = await postJson<PushSyncResponse>('/sync/push', {
        schemaVersion: SYNC_SCHEMA_VERSION,
        changes: queueItems.map((item) => ({
          queueId: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          createdAt: item.createdAt,
          payload: item.payload,
        })),
      });

      assertSupportedResponseSchemaVersion(response.schemaVersion, 'push');

      const appliedQueueIds: string[] = [];
      let appliedCount = 0;
      let conflictCount = 0;
      let failedCount = 0;
      const messages: string[] = [];

      for (const result of response.results) {
        const queueItem = queueItemsById.get(result.queueId);

        if (!queueItem) {
          continue;
        }

        messages.push(
          this.localizeSyncResult(
            result.code,
            result.message,
            '동기화 결과를 확인하지 못했습니다.',
          ),
        );

        if (result.status === 'applied') {
          const appliedLocally = await this.applySuccessfulPushResult(
            queueItem,
            result,
          );

          if (appliedLocally) {
            appliedQueueIds.push(result.queueId);
            appliedCount += 1;
          } else {
            failedCount += 1;
          }

          continue;
        }

        if (result.status === 'conflict') {
          const autoMerged = await this.applyAutoMergedPushConflict(
            queueItem,
            result,
          );

          if (autoMerged) {
            messages.push('자동 백업 내용을 정리해 다시 시도합니다.');
            continue;
          }

          const conflictMessage = this.localizeSyncResult(
            result.code,
            result.message,
            '자동 백업 중 일부 항목 확인이 필요합니다.',
          );

          conflictCount += 1;
          await this.queueRepo.markConflict(
            result.queueId,
            conflictMessage,
            this.getRemoteConflictPayload(result),
            result.code,
          );
          await this.markEntitySyncStatus(
            result.entityType,
            result.entityId,
            'conflict',
          );
        } else {
          failedCount += 1;
          await this.queueRepo.markFailed(
            result.queueId,
            this.localizeSyncResult(
              result.code,
              result.message,
              '동기화에 실패했습니다.',
            ),
          );
        }
      }

      const handledQueueIds = new Set(
        response.results.map((result) => result.queueId),
      );

      for (const queueId of queueItemIds) {
        if (handledQueueIds.has(queueId)) {
          continue;
        }

        failedCount += 1;
        messages.push(localizeSyncResultCode('result_missing'));
        await this.queueRepo.markFailed(
          queueId,
          localizeSyncResultCode('result_missing'),
        );
      }

      await this.queueRepo.removeMany(appliedQueueIds);

      return {
        attemptedCount: queueItems.length,
        appliedCount,
        conflictCount,
        failedCount,
        processedAt: response.processedAt,
        messages,
        requestFailed: false,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? localizeServerMessage(error.message, '업로드 요청에 실패했습니다.')
          : '업로드 요청에 실패했습니다.';

      try {
        await this.queueRepo.markManyFailed(queueItemIds, message);
      } catch (markError) {
        if (!isDatabaseClosedError(markError)) {
          throw markError;
        }
      }

      return {
        attemptedCount: queueItems.length,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: queueItems.length,
        processedAt: null,
        messages: [message],
        requestFailed: true,
      };
    }
  }

  async pullRemoteChanges(): Promise<PullCycleResult> {
    const since = await this.metaRepo.getValue(LAST_SUCCESSFUL_PULL_AT_KEY);

    try {
      const queueItems = await this.queueRepo.listAll();
      const queueItemsByEntityKey = new Map<string, SyncQueueItemRecord[]>();
      const worksToMerge: WorkRecord[] = [];
      const releaseRecordsToMerge: UserReleaseRecord[] = [];
      const timelineEntriesToMerge: TimelineEntryRecord[] = [];
      const seriesToMerge: SeriesRecord[] = [];
      const contributorsToMerge: ContributorRecord[] = [];
      const workSeriesLinksToMerge: WorkSeriesLinkRecord[] = [];
      const workContributorsToMerge: WorkContributorRecord[] = [];
      const workRelationsToMerge: WorkRelationRecord[] = [];
      const tierBoardsToMerge: TierBoardRecord[] = [];
      const tierBoardLanesToMerge: TierBoardLaneRecord[] = [];
      const tierBoardItemsToMerge: TierBoardItemRecord[] = [];
      const tierBoardAssetsToMerge: TierBoardAssetRecord[] = [];
      const skippedCount = 0;
      const messages: string[] = [];
      let cursor: string | null = null;
      let nextSince = since;
      let pulledAt: string | null = null;
      let pulledCount = 0;

      for (const item of queueItems) {
        const entityKey = this.getEntityKey(item.entityType, item.entityId);
        const itemsForEntity = queueItemsByEntityKey.get(entityKey) ?? [];

        itemsForEntity.push(item);
        queueItemsByEntityKey.set(entityKey, itemsForEntity);
      }

      do {
        const response: PullSyncResponse = await postJson<PullSyncResponse>(
          '/sync/pull',
          {
            cursor,
            limit: PULL_PAGE_LIMIT,
            schemaVersion: SYNC_SCHEMA_VERSION,
            since,
          },
        );

        assertSupportedResponseSchemaVersion(response.schemaVersion, 'pull');
        pulledAt = response.pulledAt;
        pulledCount += response.changes.length;
        nextSince = response.nextSince;

        for (const change of response.changes) {
          const relatedQueueItems =
            queueItemsByEntityKey.get(
              this.getEntityKey(change.entityType, change.entityId),
            ) ?? [];
          const hasLocalQueue = relatedQueueItems.length > 0;

          if (hasLocalQueue) {
            await this.autoMergePullChangeWithQueuedPayload(
              change,
              relatedQueueItems,
            );
            continue;
          }

          if (change.entityType === 'work' && change.work) {
            worksToMerge.push(change.work);
            continue;
          }

          if (change.entityType === 'release_record' && change.releaseRecord) {
            releaseRecordsToMerge.push(change.releaseRecord);
            continue;
          }

          if (change.entityType === 'timeline_entry' && change.timelineEntry) {
            timelineEntriesToMerge.push(change.timelineEntry);
            continue;
          }

          if (change.entityType === 'series' && change.series) {
            seriesToMerge.push(change.series);
            continue;
          }

          if (change.entityType === 'contributor' && change.contributor) {
            contributorsToMerge.push(change.contributor);
            continue;
          }

          if (
            change.entityType === 'work_series_link' &&
            change.workSeriesLink
          ) {
            workSeriesLinksToMerge.push(change.workSeriesLink);
            continue;
          }

          if (
            change.entityType === 'work_contributor' &&
            change.workContributor
          ) {
            workContributorsToMerge.push(change.workContributor);
            continue;
          }

          if (change.entityType === 'work_relation' && change.workRelation) {
            workRelationsToMerge.push(change.workRelation);
            continue;
          }

          if (change.entityType === 'tier_board' && change.tierBoard) {
            tierBoardsToMerge.push(change.tierBoard);
            continue;
          }

          if (change.entityType === 'tier_board_lane' && change.tierBoardLane) {
            tierBoardLanesToMerge.push(change.tierBoardLane);
            continue;
          }

          if (change.entityType === 'tier_board_item' && change.tierBoardItem) {
            tierBoardItemsToMerge.push(change.tierBoardItem);
            continue;
          }

          if (change.entityType === 'tier_board_asset' && change.tierBoardAsset) {
            tierBoardAssetsToMerge.push(change.tierBoardAsset);
          }
        }

        cursor =
          response.hasMore === true && response.nextCursor
            ? response.nextCursor
            : null;
      } while (cursor !== null);

      await this.worksRepo.bulkPut(worksToMerge);
      await this.releaseRecordsRepo.bulkPut(releaseRecordsToMerge);
      await this.timelineEntriesRepo.bulkPut(timelineEntriesToMerge);
      await this.graphRepo.bulkPutSeries(seriesToMerge);
      await this.graphRepo.bulkPutContributors(contributorsToMerge);
      await this.graphRepo.bulkPutWorkSeriesLinks(workSeriesLinksToMerge);
      await this.graphRepo.bulkPutWorkContributors(workContributorsToMerge);
      await this.graphRepo.bulkPutWorkRelations(workRelationsToMerge);
      await this.tierBoardRepo.bulkPutBoards(tierBoardsToMerge);
      await this.tierBoardRepo.bulkPutLanes(tierBoardLanesToMerge);
      await this.tierBoardRepo.bulkPutItems(tierBoardItemsToMerge);
      await this.tierBoardRepo.bulkPutAssets(tierBoardAssetsToMerge);

      if (nextSince !== null) {
        await this.metaRepo.setValue(LAST_SUCCESSFUL_PULL_AT_KEY, nextSince);
      }

      if (pulledCount === 0) {
        messages.push('가져올 변경 사항이 없습니다.');
      } else if (skippedCount > 0) {
        messages.push(
          '확인이 필요한 항목이 있어 일부 내용은 자동으로 가져오지 않았습니다.',
        );
      }

      return {
        pulledCount,
        appliedCount:
          worksToMerge.length +
          releaseRecordsToMerge.length +
          timelineEntriesToMerge.length +
          seriesToMerge.length +
          contributorsToMerge.length +
          workSeriesLinksToMerge.length +
          workContributorsToMerge.length +
          workRelationsToMerge.length +
          tierBoardsToMerge.length +
          tierBoardLanesToMerge.length +
          tierBoardItemsToMerge.length +
          tierBoardAssetsToMerge.length,
        skippedCount,
        pulledAt,
        nextSince,
        messages,
        requestFailed: false,
      };
    } catch (error) {
      return {
        pulledCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        pulledAt: null,
        nextSince: since,
        messages: [
          error instanceof Error
            ? localizeServerMessage(
                error.message,
                '가져오기 요청에 실패했습니다.',
              )
            : '가져오기 요청에 실패했습니다.',
        ],
        requestFailed: true,
      };
    }
  }

  async resolveConflictWithLocal(queueItemId: string) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const now = getNowIso();

    if (queueItem.entityType === 'release_record') {
      const localReleaseRecord =
        (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as UserReleaseRecord);
      const nextReleaseRecord: UserReleaseRecord = {
        ...cloneReleaseRecord(localReleaseRecord),
        syncStatus: 'pending',
        updatedAt: now,
      };

      await this.releaseRecordsRepo.update(nextReleaseRecord);
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord);

      return nextReleaseRecord;
    }

    if (queueItem.entityType === 'timeline_entry') {
      const localTimelineEntry =
        (await this.timelineEntriesRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as TimelineEntryRecord);
      const nextTimelineEntry: TimelineEntryRecord = {
        ...cloneTimelineEntry(localTimelineEntry),
        syncStatus: 'pending',
        updatedAt: now,
      };

      await this.timelineEntriesRepo.update(nextTimelineEntry);
      await this.queueRepo.resetForRetry(queueItem.id, nextTimelineEntry);

      return nextTimelineEntry;
    }

    if (isGraphEntityType(queueItem.entityType)) {
      const localGraphEntity =
        ((await this.graphRepo.getEntity(
          queueItem.entityType,
          queueItem.entityId,
        )) as GraphEntityRecord | null) ?? (queueItem.payload as GraphEntityRecord);
      const nextGraphEntity = {
        ...cloneGraphEntity(localGraphEntity),
        syncStatus: 'pending',
        updatedAt: now,
      } as GraphEntityRecord;

      await this.graphRepo.putEntity(nextGraphEntity);
      await this.queueRepo.resetForRetry(queueItem.id, nextGraphEntity);

      return nextGraphEntity;
    }

    if (isTierBoardEntityType(queueItem.entityType)) {
      const localTierBoardEntity =
        ((await this.tierBoardRepo.getEntity(
          queueItem.entityType,
          queueItem.entityId,
        )) as TierBoardEntityRecord | null) ??
        (queueItem.payload as TierBoardEntityRecord);
      const nextTierBoardEntity = {
        ...localTierBoardEntity,
        ...('syncStatus' in localTierBoardEntity
          ? { syncStatus: 'pending' as const }
          : {}),
        updatedAt: now,
      } as TierBoardEntityRecord;

      await this.tierBoardRepo.putEntity(nextTierBoardEntity);
      await this.queueRepo.resetForRetry(queueItem.id, nextTierBoardEntity);

      return nextTierBoardEntity;
    }

    const localWork =
      (await this.worksRepo.getById(queueItem.entityId)) ??
      (queueItem.payload as WorkRecord);
    const nextWork: WorkRecord = {
      ...cloneWorkRecord(localWork),
      syncStatus: 'pending',
      updatedAt: now,
    };

    await this.worksRepo.update(nextWork);
    await this.queueRepo.resetForRetry(queueItem.id, nextWork);

    return nextWork;
  }

  async resolveConflictWithRemote(queueItemId: string) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const remote = queueItem.conflict?.remote ?? null;

    if (!remote) {
      throw new Error('원격 스냅샷이 없어 원격 기록을 적용할 수 없습니다.');
    }

    if (queueItem.entityType === 'release_record') {
      const remoteReleaseRecord: UserReleaseRecord = {
        ...cloneReleaseRecord(remote as UserReleaseRecord),
        syncStatus: 'synced',
      };

      await this.releaseRecordsRepo.update(remoteReleaseRecord);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteReleaseRecord;
    }

    if (queueItem.entityType === 'timeline_entry') {
      const remoteTimelineEntry: TimelineEntryRecord = {
        ...cloneTimelineEntry(remote as TimelineEntryRecord),
        syncStatus: 'synced',
      };

      await this.timelineEntriesRepo.update(remoteTimelineEntry);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteTimelineEntry;
    }

    if (isGraphEntityType(queueItem.entityType)) {
      const remoteGraphEntity = {
        ...cloneGraphEntity(remote as GraphEntityRecord),
        syncStatus: 'synced',
      } as GraphEntityRecord;

      await this.graphRepo.putEntity(remoteGraphEntity);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteGraphEntity;
    }

    if (isTierBoardEntityType(queueItem.entityType)) {
      const remoteTierBoardEntity = {
        ...(remote as TierBoardEntityRecord),
        ...('syncStatus' in (remote as TierBoardEntityRecord)
          ? { syncStatus: 'synced' as const }
          : {}),
      } as TierBoardEntityRecord;

      await this.tierBoardRepo.putEntity(remoteTierBoardEntity);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteTierBoardEntity;
    }

    const remoteWork: WorkRecord = {
      ...cloneWorkRecord(remote as WorkRecord),
      syncStatus: 'synced',
    };

    await this.worksRepo.update(remoteWork);
    await this.queueRepo.removeMany([queueItem.id]);

    return remoteWork;
  }

  async resolveConflictWithMergedFields(
    queueItemId: string,
    remoteFields: readonly string[],
  ) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const remote = queueItem.conflict?.remote ?? null;

    if (!remote) {
      throw new Error('원격 스냅샷이 없어 필드별 병합을 할 수 없습니다.');
    }

    const now = getNowIso();

    if (queueItem.entityType === 'release_record') {
      const selectedFields = new Set<keyof UserReleaseRecord>(
        remoteFields.filter((field): field is ReleaseRecordConflictMergeField =>
          (RELEASE_RECORD_MERGE_FIELDS as readonly string[]).includes(field),
        ),
      );
      const localReleaseRecord =
        (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as UserReleaseRecord);
      const nextReleaseRecord = cloneReleaseRecord(localReleaseRecord);
      const remoteReleaseRecord = remote as UserReleaseRecord;

      for (const field of selectedFields) {
        nextReleaseRecord[field] = remoteReleaseRecord[field] as never;
      }

      nextReleaseRecord.syncStatus = 'pending';
      nextReleaseRecord.updatedAt = now;

      await this.releaseRecordsRepo.update(nextReleaseRecord);
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord);

      return nextReleaseRecord;
    }

    if (queueItem.entityType === 'timeline_entry') {
      return this.resolveConflictWithLocal(queueItemId);
    }

    if (isGraphEntityType(queueItem.entityType)) {
      return this.resolveConflictWithLocal(queueItemId);
    }

    if (isTierBoardEntityType(queueItem.entityType)) {
      return this.resolveConflictWithLocal(queueItemId);
    }

    const selectedFields = new Set<keyof WorkRecord>(
      remoteFields.filter((field): field is WorkConflictMergeField =>
        (WORK_MERGE_FIELDS as readonly string[]).includes(field),
      ),
    );
    const localWork =
      (await this.worksRepo.getById(queueItem.entityId)) ??
      (queueItem.payload as WorkRecord);
    const nextWork = cloneWorkRecord(localWork);
    const remoteWork = remote as WorkRecord;

    for (const field of selectedFields) {
      nextWork[field] = cloneQueuePayload(remoteWork)[field] as never;
    }

    nextWork.syncStatus = 'pending';
    nextWork.updatedAt = now;

    await this.worksRepo.update(nextWork);
    await this.queueRepo.resetForRetry(queueItem.id, nextWork);

    return nextWork;
  }

  private async applySuccessfulPushResult(
    queueItem: SyncQueueItemRecord,
    result: PushSyncResult,
  ) {
    try {
      if (isGraphEntityType(result.entityType)) {
        const remoteGraphEntity = this.getRemoteConflictPayload(
          result,
        ) as GraphEntityRecord | null;

        if (remoteGraphEntity) {
          await this.graphRepo.putEntity(remoteGraphEntity);

          return true;
        }

        await this.graphRepo.markSyncStatus(
          result.entityType,
          queueItem.entityId,
          'synced',
        );

        return true;
      }

      if (isTierBoardEntityType(result.entityType)) {
        const remoteTierBoardEntity = this.getRemoteConflictPayload(
          result,
        ) as TierBoardEntityRecord | null;

        if (remoteTierBoardEntity) {
          await this.tierBoardRepo.putEntity(remoteTierBoardEntity);

          return true;
        }

        await this.tierBoardRepo.markSyncStatus(
          result.entityType,
          queueItem.entityId,
          'synced',
        );

        return true;
      }

      if (result.entityType === 'release_record') {
        if (
          result.releaseRecord !== null &&
          result.releaseRecord !== undefined
        ) {
          await this.releaseRecordsRepo.update(result.releaseRecord);

          return true;
        }

        const localReleaseRecord = await this.releaseRecordsRepo.getById(
          queueItem.entityId,
        );

        if (!localReleaseRecord) {
          return true;
        }

        await this.releaseRecordsRepo.update({
          ...localReleaseRecord,
          syncStatus: 'synced',
        });

        return true;
      }

      if (result.entityType === 'timeline_entry') {
        if (
          result.timelineEntry !== null &&
          result.timelineEntry !== undefined
        ) {
          await this.timelineEntriesRepo.update(result.timelineEntry);

          return true;
        }

        const localTimelineEntry = await this.timelineEntriesRepo.getById(
          queueItem.entityId,
        );

        if (!localTimelineEntry) {
          return true;
        }

        await this.timelineEntriesRepo.update({
          ...localTimelineEntry,
          syncStatus: 'synced',
        });

        return true;
      }

      if (result.work !== null && result.work !== undefined) {
        await this.worksRepo.update(result.work);

        return true;
      }

      const localWork = await this.worksRepo.getById(queueItem.entityId);

      if (!localWork) {
        return true;
      }

      await this.worksRepo.update({
        ...localWork,
        syncStatus: 'synced',
      });

      return true;
    } catch (error) {
      await this.queueRepo.markFailed(
        queueItem.id,
        error instanceof Error
          ? `동기화 후 화면에 반영하지 못했습니다: ${localizeServerMessage(
              error.message,
              '화면을 업데이트하는 중 문제가 발생했습니다.',
            )}`
          : '동기화 후 화면에 반영하지 못했습니다.',
      );

      return false;
    }
  }

  private async applyAutoMergedPushConflict(
    queueItem: SyncQueueItemRecord,
    result: PushSyncResult,
  ) {
    const remote = this.getRemoteConflictPayload(result);

    if (!remote) {
      return false;
    }

    try {
      if (isGraphEntityType(result.entityType)) {
        const localGraphEntity =
          ((await this.graphRepo.getEntity(
            queueItem.entityType,
            queueItem.entityId,
          )) as GraphEntityRecord | null) ?? (queueItem.payload as GraphEntityRecord);
        const merged = mergeGraphEntitySnapshots(
          remote as GraphEntityRecord,
          localGraphEntity,
        );

        await this.graphRepo.putEntity(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);

        return true;
      }

      if (isTierBoardEntityType(result.entityType)) {
        const localTierBoardEntity =
          ((await this.tierBoardRepo.getEntity(
            queueItem.entityType,
            queueItem.entityId,
          )) as TierBoardEntityRecord | null) ??
          (queueItem.payload as TierBoardEntityRecord);
        const merged = mergeTierBoardEntitySnapshots(
          remote as TierBoardEntityRecord,
          localTierBoardEntity,
        );

        await this.tierBoardRepo.putEntity(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);

        return true;
      }

      if (result.entityType === 'release_record') {
        const localReleaseRecord =
          (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
          (queueItem.payload as UserReleaseRecord);
        const merged = mergeReleaseRecordSnapshots(
          remote as UserReleaseRecord,
          localReleaseRecord,
        );

        await this.releaseRecordsRepo.update(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);

        return true;
      }

      if (result.entityType === 'timeline_entry') {
        const localTimelineEntry =
          (await this.timelineEntriesRepo.getById(queueItem.entityId)) ??
          (queueItem.payload as TimelineEntryRecord);
        const merged = mergeTimelineEntrySnapshots(
          remote as TimelineEntryRecord,
          localTimelineEntry,
        );

        await this.timelineEntriesRepo.update(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);

        return true;
      }

      const localWork =
        (await this.worksRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as WorkRecord);
      const merged = mergeWorkSnapshots(remote as WorkRecord, localWork);

      await this.worksRepo.update(merged);
      await this.queueRepo.resetForRetry(queueItem.id, merged);

      return true;
    } catch {
      return false;
    }
  }

  private async markWorkSyncStatus(id: string, syncStatus: WorkSyncStatus) {
    const work = await this.worksRepo.getById(id);

    if (!work || work.syncStatus === syncStatus) {
      return;
    }

    await this.worksRepo.update({
      ...work,
      syncStatus,
    });
  }

  private async markReleaseRecordSyncStatus(
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    const releaseRecord = await this.releaseRecordsRepo.getById(id);

    if (!releaseRecord || releaseRecord.syncStatus === syncStatus) {
      return;
    }

    await this.releaseRecordsRepo.update({
      ...releaseRecord,
      syncStatus,
    });
  }

  private async markTimelineEntrySyncStatus(
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    const timelineEntry = await this.timelineEntriesRepo.getById(id);

    if (!timelineEntry || timelineEntry.syncStatus === syncStatus) {
      return;
    }

    await this.timelineEntriesRepo.update({
      ...timelineEntry,
      syncStatus,
    });
  }

  private markEntitySyncStatus(
    entityType: SyncEntityType,
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    if (entityType === 'work') {
      return this.markWorkSyncStatus(id, syncStatus);
    }

    if (entityType === 'release_record') {
      return this.markReleaseRecordSyncStatus(id, syncStatus);
    }

    if (entityType === 'timeline_entry') {
      return this.markTimelineEntrySyncStatus(id, syncStatus);
    }

    if (isTierBoardEntityType(entityType)) {
      return this.tierBoardRepo.markSyncStatus(entityType, id, syncStatus);
    }

    return this.graphRepo.markSyncStatus(entityType, id, syncStatus);
  }

  private getEntityKey(entityType: SyncEntityType, entityId: string) {
    return `${entityType}:${entityId}`;
  }

  private getRemoteConflictPayload(result: PushSyncResult) {
    if (result.entityType === 'release_record') {
      return result.releaseRecord ?? null;
    }

    if (result.entityType === 'timeline_entry') {
      return result.timelineEntry ?? null;
    }

    if (result.entityType === 'series') {
      return result.series ?? null;
    }

    if (result.entityType === 'contributor') {
      return result.contributor ?? null;
    }

    if (result.entityType === 'work_series_link') {
      return result.workSeriesLink ?? null;
    }

    if (result.entityType === 'work_contributor') {
      return result.workContributor ?? null;
    }

    if (result.entityType === 'work_relation') {
      return result.workRelation ?? null;
    }

    if (result.entityType === 'tier_board') {
      return result.tierBoard ?? null;
    }

    if (result.entityType === 'tier_board_lane') {
      return result.tierBoardLane ?? null;
    }

    if (result.entityType === 'tier_board_item') {
      return result.tierBoardItem ?? null;
    }

    if (result.entityType === 'tier_board_asset') {
      return result.tierBoardAsset ?? null;
    }

    return result.work ?? null;
  }

  private getRemotePullConflictPayload(change: PullSyncChange) {
    if (change.entityType === 'release_record') {
      return change.releaseRecord ?? null;
    }

    if (change.entityType === 'timeline_entry') {
      return change.timelineEntry ?? null;
    }

    if (change.entityType === 'series') {
      return change.series ?? null;
    }

    if (change.entityType === 'contributor') {
      return change.contributor ?? null;
    }

    if (change.entityType === 'work_series_link') {
      return change.workSeriesLink ?? null;
    }

    if (change.entityType === 'work_contributor') {
      return change.workContributor ?? null;
    }

    if (change.entityType === 'work_relation') {
      return change.workRelation ?? null;
    }

    if (change.entityType === 'tier_board') {
      return change.tierBoard ?? null;
    }

    if (change.entityType === 'tier_board_lane') {
      return change.tierBoardLane ?? null;
    }

    if (change.entityType === 'tier_board_item') {
      return change.tierBoardItem ?? null;
    }

    if (change.entityType === 'tier_board_asset') {
      return change.tierBoardAsset ?? null;
    }

    return change.work ?? null;
  }

  private async autoMergePullChangeWithQueuedPayload(
    change: PullSyncChange,
    queueItems: SyncQueueItemRecord[],
  ) {
    if (change.entityType === 'work' && change.work) {
      for (const queueItem of queueItems) {
        const merged = mergePulledWorkWithQueuedPayload(
          change.work,
          queueItem.payload as WorkRecord,
        );

        await this.worksRepo.update(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);
      }

      return;
    }

    if (change.entityType === 'release_record' && change.releaseRecord) {
      for (const queueItem of queueItems) {
        const merged = mergePulledReleaseRecordWithQueuedPayload(
          change.releaseRecord,
          queueItem.payload as UserReleaseRecord,
        );

        await this.releaseRecordsRepo.update(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);
      }

      return;
    }

    if (change.entityType === 'timeline_entry' && change.timelineEntry) {
      for (const queueItem of queueItems) {
        const merged = mergePulledTimelineEntryWithQueuedPayload(
          change.timelineEntry,
          queueItem.payload as TimelineEntryRecord,
        );

      await this.timelineEntriesRepo.update(merged);
      await this.queueRepo.resetForRetry(queueItem.id, merged);
      }

      return;
    }

    if (isGraphEntityType(change.entityType)) {
      const remoteGraphEntity = this.getRemotePullConflictPayload(
        change,
      ) as GraphEntityRecord | null;

      if (!remoteGraphEntity) {
        return;
      }

      for (const queueItem of queueItems) {
        const merged = mergeGraphEntitySnapshots(
          remoteGraphEntity,
          queueItem.payload as GraphEntityRecord,
        );

        await this.graphRepo.putEntity(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);
      }
    }

    if (isTierBoardEntityType(change.entityType)) {
      const remoteTierBoardEntity = this.getRemotePullConflictPayload(
        change,
      ) as TierBoardEntityRecord | null;

      if (!remoteTierBoardEntity) {
        return;
      }

      for (const queueItem of queueItems) {
        const merged = mergeTierBoardEntitySnapshots(
          remoteTierBoardEntity,
          queueItem.payload as TierBoardEntityRecord,
        );

        await this.tierBoardRepo.putEntity(merged);
        await this.queueRepo.resetForRetry(queueItem.id, merged);
      }
    }
  }

  private localizeSyncResult(
    code: SyncResultCode | null | undefined,
    message: string,
    fallback: string,
  ) {
    if (code) {
      return localizeSyncResultCode(code, fallback);
    }

    return localizeServerMessage(message, fallback);
  }
}

export const syncService = new SyncService();
