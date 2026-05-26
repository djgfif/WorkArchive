import type {
  ContributorRecord,
  PullSyncResponse,
  PullSyncChange,
  PushSyncResponse,
  PushSyncResult,
  SyncAutoMergeSnapshot,
  SeriesRecord,
  SyncEntityType,
  SyncQueuePayload,
  SyncQueueItemRecord,
  SyncResultCode,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierLaneRecord,
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

import { requestAuthenticatedApiJson } from '@shared/services/api-client';
import {
  graphRepository,
  moveUnknownGenresToPersonalTags,
  releaseRecordsRepository,
  timelineEntriesRepository,
  worksRepository,
  type GraphRepository,
  type ReleaseRecordsRepository,
  type TimelineEntriesRepository,
  type WorksRepository,
} from '@features/works/data';
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
} from '@shared/utils/localize-message';
import {
  tierBoardRepository,
  type TierBoardRepository,
} from '@features/tier-boards/data';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';
export const SYNC_STALE_STATUS_AT_KEY = 'sync.staleStatusAt';
export const SYNC_STALE_STATUS_REASON_KEY = 'sync.staleStatusReason';
const SYNC_CLIENT_ID_KEY = 'sync.clientId';
const SYNC_LEASE_KEY = 'sync.activeLease';
const SYNC_LEASE_TTL_MS = 25_000;
const SYNC_FRESH_PULL_WINDOW_MS = 2 * 60_000;
const PULL_PAGE_LIMIT = 500;
const TAB_SESSION_ID = crypto.randomUUID();

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
  | TierLaneRecord
  | TierBoardCardRecord
  | TierBoardAssetRecord;
type AutoMergeOutcome<TPayload extends SyncQueuePayload> =
  | {
      merged: TPayload;
      mergedFields: string[];
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

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

type SyncLeaseOperation = 'pull' | 'push';

interface SyncClientIdentity {
  clientId: string;
  ownerId: string;
}

interface SyncLeaseContext extends SyncClientIdentity {
  leaseToken: string;
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
    'boardType' in payload ||
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

function addMilliseconds(value: string, milliseconds: number) {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function getLatestIso(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function mergeUniqueValues(left: readonly string[], right: readonly string[]) {
  return Array.from(new Set([...left, ...right]));
}

function areEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function haveSameFieldValues<TRecord extends object>(
  remote: TRecord,
  localPayload: TRecord,
  fields: readonly (keyof TRecord)[],
) {
  return fields.every((field) => areEqual(remote[field], localPayload[field]));
}

function hasDeleteUpdateCollision(
  remote: { deletedAt: string | null },
  localPayload: { deletedAt: string | null },
) {
  return remote.deletedAt !== null || localPayload.deletedAt !== null;
}

function createAutoMergeSnapshot(
  mergedFields: readonly string[],
): SyncAutoMergeSnapshot {
  return {
    fields: [...mergedFields],
    mergedAt: getNowIso(),
    message: '안전한 필드만 자동 병합되어 다시 백업 대기 중입니다.',
    status: 'requeued',
  };
}

function canAutoMergePushResult(result: PushSyncResult) {
  return result.code === 'conflict_remote_newer';
}

function getPayloadServerVersion(payload: SyncQueuePayload) {
  return 'serverVersion' in payload ? payload.serverVersion : 0;
}

function isRemoteBackedQueueItem(item: SyncQueueItemRecord) {
  return getPayloadServerVersion(item.payload) > 0;
}

function shouldWaitForQueueBackoff(
  item: SyncQueueItemRecord,
  nowMs = Date.now(),
) {
  if (!item.nextRetryAt) {
    return false;
  }

  const nextRetryAtMs = Date.parse(item.nextRetryAt);

  return Number.isFinite(nextRetryAtMs) && nextRetryAtMs > nowMs;
}

function isFreshPull(lastSuccessfulPullAt: string | null) {
  if (!lastSuccessfulPullAt) {
    return false;
  }

  const pulledAtMs = Date.parse(lastSuccessfulPullAt);

  return (
    Number.isFinite(pulledAtMs) &&
    Date.now() - pulledAtMs <= SYNC_FRESH_PULL_WINDOW_MS
  );
}

function getRunnableQueueItems(queueItems: SyncQueueItemRecord[]) {
  return queueItems.filter(
    (item) => !item.conflict && !shouldWaitForQueueBackoff(item),
  );
}

function mergeWorkSafely(
  remote: WorkRecord,
  localPayload: WorkRecord,
): AutoMergeOutcome<WorkRecord> {
  if (remote.id !== localPayload.id) {
    return { ok: false, reason: 'entity_mismatch' };
  }

  if (hasDeleteUpdateCollision(remote, localPayload)) {
    return { ok: false, reason: 'delete_update_collision' };
  }

  const scalarFields = [
    'catalogTitleId',
    'importDraft',
    'type',
    'title',
    'author',
    'description',
    'thumbnailUrl',
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
  ] as const satisfies readonly (keyof WorkRecord)[];

  if (!haveSameFieldValues(remote, localPayload, scalarFields)) {
    return { ok: false, reason: 'overlapping_field_change' };
  }

  const taxonomy = moveUnknownGenresToPersonalTags(
    mergeUniqueValues(remote.genres, localPayload.genres),
    mergeUniqueValues(remote.personalTags, localPayload.personalTags),
  );

  return {
    ok: true,
    merged: {
      ...cloneWorkRecord(localPayload),
      createdAt: remote.createdAt,
      deletedAt: null,
      genres: taxonomy.genres,
      personalTags: taxonomy.personalTags,
      serverVersion: remote.serverVersion,
      syncStatus: 'pending',
      updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
    },
    mergedFields: ['genres', 'personalTags'],
  };
}

function mergeReleaseRecordSafely(
  remote: UserReleaseRecord,
  localPayload: UserReleaseRecord,
): AutoMergeOutcome<UserReleaseRecord> {
  if (
    remote.id !== localPayload.id ||
    remote.userWorkRecordId !== localPayload.userWorkRecordId ||
    remote.catalogReleaseId !== localPayload.catalogReleaseId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (hasDeleteUpdateCollision(remote, localPayload)) {
    return { ok: false, reason: 'delete_update_collision' };
  }

  const fields = [
    'status',
    'rating',
    'shortReview',
    'review',
    'favorite',
  ] as const satisfies readonly (keyof UserReleaseRecord)[];

  if (!haveSameFieldValues(remote, localPayload, fields)) {
    return { ok: false, reason: 'overlapping_field_change' };
  }

  return {
    ok: true,
    merged: {
      ...cloneReleaseRecord(localPayload),
      createdAt: remote.createdAt,
      serverVersion: remote.serverVersion,
      syncStatus: 'pending',
      updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
    },
    mergedFields: [],
  };
}

function mergeTimelineEntrySafely(
  remote: TimelineEntryRecord,
  localPayload: TimelineEntryRecord,
): AutoMergeOutcome<TimelineEntryRecord> {
  if (remote.id !== localPayload.id || remote.workId !== localPayload.workId) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (hasDeleteUpdateCollision(remote, localPayload)) {
    return { ok: false, reason: 'delete_update_collision' };
  }

  const fields = [
    'type',
    'occurredAt',
    'note',
  ] as const satisfies readonly (keyof TimelineEntryRecord)[];

  if (!haveSameFieldValues(remote, localPayload, fields)) {
    return { ok: false, reason: 'overlapping_field_change' };
  }

  return {
    ok: true,
    merged: {
      ...cloneTimelineEntry(localPayload),
      createdAt: remote.createdAt,
      serverVersion: remote.serverVersion,
      syncStatus: 'pending',
      updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
    },
    mergedFields: [],
  };
}

function mergeGraphEntitySafely<TRecord extends GraphEntityRecord>(
  remote: TRecord,
  localPayload: TRecord,
): AutoMergeOutcome<TRecord> {
  if (remote.id !== localPayload.id) {
    return { ok: false, reason: 'entity_mismatch' };
  }

  if (hasDeleteUpdateCollision(remote, localPayload)) {
    return { ok: false, reason: 'delete_update_collision' };
  }

  if (
    'parentId' in remote &&
    remote.parentId !== (localPayload as SeriesRecord).parentId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (
    'workId' in remote &&
    remote.workId !==
      (localPayload as WorkSeriesLinkRecord | WorkContributorRecord).workId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (
    'sourceWorkId' in remote &&
    (remote.sourceWorkId !==
      (localPayload as WorkRelationRecord).sourceWorkId ||
      remote.targetWorkId !== (localPayload as WorkRelationRecord).targetWorkId)
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  const mergedFields: string[] = [];
  let scalarFields: readonly string[];

  if ('aliases' in remote) {
    scalarFields =
      'kind' in remote
        ? [
            'title',
            'normalizedTitle',
            'kind',
            'parentId',
            'description',
            'thumbnailUrl',
          ]
        : ['name', 'normalizedName', 'entityType'];
    mergedFields.push('aliases');
  } else if ('seriesId' in remote) {
    scalarFields = ['workId', 'seriesId', 'role', 'orderIndex', 'orderLabel'];
  } else if ('contributorId' in remote) {
    scalarFields = ['workId', 'contributorId', 'role', 'displayOrder'];
  } else {
    scalarFields = ['sourceWorkId', 'targetWorkId', 'relationType', 'note'];
  }

  if (
    !scalarFields.every((field) =>
      areEqual(
        (remote as unknown as Record<string, unknown>)[field],
        (localPayload as unknown as Record<string, unknown>)[field],
      ),
    )
  ) {
    return { ok: false, reason: 'overlapping_field_change' };
  }

  const merged = {
    ...cloneGraphEntity(localPayload),
    createdAt: remote.createdAt,
    serverVersion: remote.serverVersion,
    syncStatus: 'pending',
    updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
    ...('aliases' in remote
      ? {
          aliases: mergeUniqueValues(
            remote.aliases,
            (localPayload as ContributorRecord | SeriesRecord).aliases,
          ),
        }
      : {}),
  } as TRecord;

  return {
    ok: true,
    merged,
    mergedFields,
  };
}

function mergeTierBoardEntitySafely<TRecord extends TierBoardEntityRecord>(
  remote: TRecord,
  localPayload: TRecord,
): AutoMergeOutcome<TRecord> {
  if (remote.id !== localPayload.id) {
    return { ok: false, reason: 'entity_mismatch' };
  }

  if (hasDeleteUpdateCollision(remote, localPayload)) {
    return { ok: false, reason: 'delete_update_collision' };
  }

  if (
    'boardId' in remote &&
    remote.boardId !==
      (
        localPayload as
          | TierLaneRecord
          | TierBoardCardRecord
          | TierBoardAssetRecord
      ).boardId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (
    'laneId' in remote &&
    remote.laneId !== (localPayload as TierBoardCardRecord).laneId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  if (
    'cardId' in remote &&
    remote.cardId !== (localPayload as TierBoardAssetRecord).cardId
  ) {
    return { ok: false, reason: 'parent_mismatch' };
  }

  const scalarFields =
    'slug' in remote
      ? [
          'title',
          'description',
          'slug',
          'boardType',
          'visibility',
          'coverImageUrl',
        ]
      : 'colorToken' in remote
        ? ['boardId', 'title', 'description', 'colorToken', 'orderIndex']
        : 'cardSourceType' in remote
          ? [
              'boardId',
              'laneId',
              'cardSourceType',
              'workId',
              'orderIndex',
              'title',
              'subtitle',
              'imageUrl',
              'note',
            ]
          : [
              'boardId',
              'cardId',
              'kind',
              'storageType',
              'objectUrl',
              'originalName',
              'mimeType',
              'sizeBytes',
            ];

  if (
    !scalarFields.every((field) =>
      areEqual(
        (remote as unknown as Record<string, unknown>)[field],
        (localPayload as unknown as Record<string, unknown>)[field],
      ),
    )
  ) {
    return { ok: false, reason: 'overlapping_field_change' };
  }

  return {
    ok: true,
    merged: {
      ...localPayload,
      createdAt: remote.createdAt,
      ...('serverVersion' in remote
        ? { serverVersion: remote.serverVersion, syncStatus: 'pending' }
        : {}),
      updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
    } as TRecord,
    mergedFields: [],
  };
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
    entityType === 'tier_lane' ||
    entityType === 'tier_board_card' ||
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

  private async getClientIdentity(): Promise<SyncClientIdentity> {
    const clientId = await this.metaRepo.getOrCreateValue(
      SYNC_CLIENT_ID_KEY,
      () => crypto.randomUUID(),
    );

    return {
      clientId,
      ownerId: `${clientId}:${TAB_SESSION_ID}`,
    };
  }

  private async withSyncLease<T>(
    operation: SyncLeaseOperation,
    onBusy: () => T,
    run: (context: SyncLeaseContext) => Promise<T>,
  ): Promise<T> {
    const identity = await this.getClientIdentity();
    const acquiredAt = getNowIso();
    const lease = await this.metaRepo.acquireLease(SYNC_LEASE_KEY, {
      acquiredAt,
      expiresAt: addMilliseconds(acquiredAt, SYNC_LEASE_TTL_MS),
      ownerId: identity.ownerId,
      token: `${operation}:${crypto.randomUUID()}`,
    });

    if (!lease) {
      return onBusy();
    }

    try {
      return await run({
        ...identity,
        leaseToken: lease.token,
      });
    } finally {
      await this.metaRepo.releaseLease(SYNC_LEASE_KEY, lease.token);
    }
  }

  private extendActiveSyncLease(context: SyncLeaseContext) {
    return this.metaRepo.extendLease(
      SYNC_LEASE_KEY,
      context.leaseToken,
      addMilliseconds(getNowIso(), SYNC_LEASE_TTL_MS),
    );
  }

  private async setStaleStatus(reason: string) {
    await Promise.all([
      this.metaRepo.setValue(SYNC_STALE_STATUS_AT_KEY, getNowIso()),
      this.metaRepo.setValue(SYNC_STALE_STATUS_REASON_KEY, reason),
    ]);
  }

  private async clearStaleStatus() {
    await Promise.all([
      this.metaRepo.removeValue(SYNC_STALE_STATUS_AT_KEY),
      this.metaRepo.removeValue(SYNC_STALE_STATUS_REASON_KEY),
    ]);
  }

  private buildPushLeaseBusyResult(): PushCycleResult {
    return {
      attemptedCount: 0,
      appliedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      processedAt: null,
      messages: ['다른 탭에서 동기화 중이라 이번 백업을 건너뛰었습니다.'],
      requestFailed: false,
    };
  }

  private buildPullLeaseBusyResult(): PullCycleResult {
    return {
      pulledCount: 0,
      appliedCount: 0,
      skippedCount: 0,
      pulledAt: null,
      nextSince: null,
      messages: ['다른 탭에서 동기화 중이라 이번 가져오기를 건너뛰었습니다.'],
      requestFailed: false,
    };
  }

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
    return this.withSyncLease(
      'push',
      () => this.buildPushLeaseBusyResult(),
      (identity) => this.pushQueuedChangesWithLease(identity),
    );
  }

  private async pushQueuedChangesWithLease(
    identity: SyncLeaseContext,
  ): Promise<PushCycleResult> {
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

    const runnableQueueItems = getRunnableQueueItems(queueItems);
    const manualReviewCount = queueItems.filter((item) => item.conflict).length;
    const backoffCount = queueItems.length - manualReviewCount - runnableQueueItems.length;

    if (runnableQueueItems.length === 0) {
      const messages = [];

      if (manualReviewCount > 0) {
        messages.push('직접 확인이 필요한 항목은 자동 백업하지 않습니다.');
      }

      if (backoffCount > 0) {
        messages.push('실패한 항목은 다음 자동 재시도 시간까지 기다립니다.');
      }

      return {
        attemptedCount: 0,
        appliedCount: 0,
        conflictCount: manualReviewCount,
        failedCount: 0,
        processedAt: null,
        messages,
        requestFailed: false,
      };
    }

    const freshnessResult = await this.ensureFreshPullBeforePush(
      runnableQueueItems,
      identity,
    );

    if (freshnessResult) {
      if (freshnessResult.requestFailed || freshnessResult.skippedCount > 0) {
        return {
          attemptedCount: 0,
          appliedCount: 0,
          conflictCount: freshnessResult.skippedCount,
          failedCount: freshnessResult.requestFailed
            ? runnableQueueItems.length
            : 0,
          processedAt: null,
          messages: [
            ...freshnessResult.messages,
            freshnessResult.requestFailed
              ? '최신 원격 변경을 확인하지 못해 자동 백업을 중단했습니다.'
              : '직접 확인이 필요한 항목이 있어 자동 백업을 중단했습니다.',
          ],
          requestFailed: freshnessResult.requestFailed,
        };
      }

      return this.pushQueuedChangesWithLease(identity);
    }

    const queueItemIds = runnableQueueItems.map((item) => item.id);
    const queueItemsById = new Map(
      runnableQueueItems.map((item) => [item.id, item]),
    );

    try {
      await this.extendActiveSyncLease(identity);
      const response = await postJson<PushSyncResponse>('/sync/push', {
        clientId: identity.clientId,
        schemaVersion: SYNC_SCHEMA_VERSION,
        changes: runnableQueueItems.map((item) => ({
          queueId: item.id,
          clientMutationId: item.clientMutationId ?? item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          createdAt: item.createdAt,
          payload: item.payload,
        })),
      });

      assertSupportedResponseSchemaVersion(response.schemaVersion, 'push');
      await this.extendActiveSyncLease(identity);

      const appliedQueueIds: string[] = [];
      let appliedCount = 0;
      let conflictCount = 0;
      let failedCount = 0;
      const messages: string[] = [];

      for (const result of response.results) {
        await this.extendActiveSyncLease(identity);
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
        attemptedCount: runnableQueueItems.length,
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
        attemptedCount: runnableQueueItems.length,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: runnableQueueItems.length,
        processedAt: null,
        messages: [message],
        requestFailed: true,
      };
    }
  }

  async pullRemoteChanges(): Promise<PullCycleResult> {
    return this.withSyncLease(
      'pull',
      () => this.buildPullLeaseBusyResult(),
      (identity) => this.pullRemoteChangesWithLease(identity),
    );
  }

  private async ensureFreshPullBeforePush(
    queueItems: SyncQueueItemRecord[],
    identity: SyncLeaseContext,
  ): Promise<PullCycleResult | null> {
    if (!queueItems.some(isRemoteBackedQueueItem)) {
      return null;
    }

    const lastSuccessfulPullAt = await this.metaRepo.getValue(
      LAST_SUCCESSFUL_PULL_AT_KEY,
    );

    if (isFreshPull(lastSuccessfulPullAt)) {
      return null;
    }

    await this.setStaleStatus('remote_check_required_before_push');

    const pull = await this.pullRemoteChangesWithLease(identity);

    if (pull.requestFailed) {
      await this.setStaleStatus('remote_check_failed_before_push');
      return pull;
    }

    if (pull.skippedCount > 0) {
      await this.setStaleStatus('manual_review_required_after_pull');
      return pull;
    }

    await this.clearStaleStatus();

    return pull;
  }

  private async pullRemoteChangesWithLease(
    identity: SyncLeaseContext,
  ): Promise<PullCycleResult> {
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
      const tierLanesToMerge: TierLaneRecord[] = [];
      const tierBoardCardsToMerge: TierBoardCardRecord[] = [];
      const tierBoardAssetsToMerge: TierBoardAssetRecord[] = [];
      let skippedCount = 0;
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
        await this.extendActiveSyncLease(identity);
        const response: PullSyncResponse = await postJson<PullSyncResponse>(
          '/sync/pull',
          {
            clientId: identity.clientId,
            cursor,
            limit: PULL_PAGE_LIMIT,
            schemaVersion: SYNC_SCHEMA_VERSION,
            since,
          },
        );

        assertSupportedResponseSchemaVersion(response.schemaVersion, 'pull');
        await this.extendActiveSyncLease(identity);
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
            const autoMerged = await this.autoMergePullChangeWithQueuedPayload(
              change,
              relatedQueueItems,
            );

            if (!autoMerged) {
              skippedCount += relatedQueueItems.length;
              const remote = this.getRemotePullConflictPayload(change);
              const conflictMessage =
                '원격 변경과 로컬 대기열을 자동 병합할 수 없어 직접 확인이 필요합니다.';

              for (const queueItem of relatedQueueItems) {
                await this.queueRepo.markConflict(
                  queueItem.id,
                  conflictMessage,
                  remote,
                  'pull_conflict_local_queue',
                );
                await this.markEntitySyncStatus(
                  queueItem.entityType,
                  queueItem.entityId,
                  'conflict',
                );
              }
            } else {
              messages.push(
                '안전한 원격 변경을 자동 병합해 다시 백업 대기 중입니다.',
              );
            }

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

          if (change.entityType === 'tier_lane' && change.tierLane) {
            tierLanesToMerge.push(change.tierLane);
            continue;
          }

          if (change.entityType === 'tier_board_card' && change.tierBoardCard) {
            tierBoardCardsToMerge.push(change.tierBoardCard);
            continue;
          }

          if (
            change.entityType === 'tier_board_asset' &&
            change.tierBoardAsset
          ) {
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
      await this.tierBoardRepo.bulkPutLanes(tierLanesToMerge);
      await this.tierBoardRepo.bulkPutCards(tierBoardCardsToMerge);
      await this.tierBoardRepo.bulkPutAssets(tierBoardAssetsToMerge);

      if (nextSince !== null) {
        await this.metaRepo.setValue(LAST_SUCCESSFUL_PULL_AT_KEY, nextSince);
        await this.clearStaleStatus();
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
          tierLanesToMerge.length +
          tierBoardCardsToMerge.length +
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
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord, {
        rotateClientMutationId: true,
      });

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
      await this.queueRepo.resetForRetry(queueItem.id, nextTimelineEntry, {
        rotateClientMutationId: true,
      });

      return nextTimelineEntry;
    }

    if (isGraphEntityType(queueItem.entityType)) {
      const localGraphEntity =
        ((await this.graphRepo.getEntity(
          queueItem.entityType,
          queueItem.entityId,
        )) as GraphEntityRecord | null) ??
        (queueItem.payload as GraphEntityRecord);
      const nextGraphEntity = {
        ...cloneGraphEntity(localGraphEntity),
        syncStatus: 'pending',
        updatedAt: now,
      } as GraphEntityRecord;

      await this.graphRepo.putEntity(nextGraphEntity);
      await this.queueRepo.resetForRetry(queueItem.id, nextGraphEntity, {
        rotateClientMutationId: true,
      });

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
      await this.queueRepo.resetForRetry(queueItem.id, nextTierBoardEntity, {
        rotateClientMutationId: true,
      });

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
    await this.queueRepo.resetForRetry(queueItem.id, nextWork, {
      rotateClientMutationId: true,
    });

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
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord, {
        rotateClientMutationId: true,
      });

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
    await this.queueRepo.resetForRetry(queueItem.id, nextWork, {
      rotateClientMutationId: true,
    });

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
    if (!canAutoMergePushResult(result)) {
      return false;
    }

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
          )) as GraphEntityRecord | null) ??
          (queueItem.payload as GraphEntityRecord);
        const outcome = mergeGraphEntitySafely(
          remote as GraphEntityRecord,
          localGraphEntity,
        );

        if (!outcome.ok) {
          return false;
        }

        await this.graphRepo.putEntity(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });

        return true;
      }

      if (isTierBoardEntityType(result.entityType)) {
        const localTierBoardEntity =
          ((await this.tierBoardRepo.getEntity(
            queueItem.entityType,
            queueItem.entityId,
          )) as TierBoardEntityRecord | null) ??
          (queueItem.payload as TierBoardEntityRecord);
        const outcome = mergeTierBoardEntitySafely(
          remote as TierBoardEntityRecord,
          localTierBoardEntity,
        );

        if (!outcome.ok) {
          return false;
        }

        await this.tierBoardRepo.putEntity(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });

        return true;
      }

      if (result.entityType === 'release_record') {
        const localReleaseRecord =
          (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
          (queueItem.payload as UserReleaseRecord);
        const outcome = mergeReleaseRecordSafely(
          remote as UserReleaseRecord,
          localReleaseRecord,
        );

        if (!outcome.ok) {
          return false;
        }

        await this.releaseRecordsRepo.update(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });

        return true;
      }

      if (result.entityType === 'timeline_entry') {
        const localTimelineEntry =
          (await this.timelineEntriesRepo.getById(queueItem.entityId)) ??
          (queueItem.payload as TimelineEntryRecord);
        const outcome = mergeTimelineEntrySafely(
          remote as TimelineEntryRecord,
          localTimelineEntry,
        );

        if (!outcome.ok) {
          return false;
        }

        await this.timelineEntriesRepo.update(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });

        return true;
      }

      const localWork =
        (await this.worksRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as WorkRecord);
      const outcome = mergeWorkSafely(remote as WorkRecord, localWork);

      if (!outcome.ok) {
        return false;
      }

      await this.worksRepo.update(outcome.merged);
      await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
        autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
        rotateClientMutationId: true,
      });

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

    if (result.entityType === 'tier_lane') {
      return result.tierLane ?? null;
    }

    if (result.entityType === 'tier_board_card') {
      return result.tierBoardCard ?? null;
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

    if (change.entityType === 'tier_lane') {
      return change.tierLane ?? null;
    }

    if (change.entityType === 'tier_board_card') {
      return change.tierBoardCard ?? null;
    }

    if (change.entityType === 'tier_board_asset') {
      return change.tierBoardAsset ?? null;
    }

    return change.work ?? null;
  }

  private async autoMergePullChangeWithQueuedPayload(
    change: PullSyncChange,
    queueItems: SyncQueueItemRecord[],
  ): Promise<boolean> {
    if (change.operation === 'delete') {
      return false;
    }

    if (change.entityType === 'work' && change.work) {
      const remoteWork = change.work;
      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: mergeWorkSafely(
          remoteWork,
          queueItem.payload as WorkRecord,
        ),
      }));

      if (outcomes.some(({ outcome }) => !outcome.ok)) {
        return false;
      }

      for (const { queueItem, outcome } of outcomes) {
        if (!outcome.ok) {
          return false;
        }

        await this.worksRepo.update(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });
      }

      return true;
    }

    if (change.entityType === 'release_record' && change.releaseRecord) {
      const remoteReleaseRecord = change.releaseRecord;
      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: mergeReleaseRecordSafely(
          remoteReleaseRecord,
          queueItem.payload as UserReleaseRecord,
        ),
      }));

      if (outcomes.some(({ outcome }) => !outcome.ok)) {
        return false;
      }

      for (const { queueItem, outcome } of outcomes) {
        if (!outcome.ok) {
          return false;
        }

        await this.releaseRecordsRepo.update(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });
      }

      return true;
    }

    if (change.entityType === 'timeline_entry' && change.timelineEntry) {
      const remoteTimelineEntry = change.timelineEntry;
      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: mergeTimelineEntrySafely(
          remoteTimelineEntry,
          queueItem.payload as TimelineEntryRecord,
        ),
      }));

      if (outcomes.some(({ outcome }) => !outcome.ok)) {
        return false;
      }

      for (const { queueItem, outcome } of outcomes) {
        if (!outcome.ok) {
          return false;
        }

        await this.timelineEntriesRepo.update(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });
      }

      return true;
    }

    if (isGraphEntityType(change.entityType)) {
      const remoteGraphEntity = this.getRemotePullConflictPayload(
        change,
      ) as GraphEntityRecord | null;

      if (!remoteGraphEntity) {
        return false;
      }

      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: mergeGraphEntitySafely(
          remoteGraphEntity,
          queueItem.payload as GraphEntityRecord,
        ),
      }));

      if (outcomes.some(({ outcome }) => !outcome.ok)) {
        return false;
      }

      for (const { queueItem, outcome } of outcomes) {
        if (!outcome.ok) {
          return false;
        }

        await this.graphRepo.putEntity(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });
      }

      return true;
    }

    if (isTierBoardEntityType(change.entityType)) {
      const remoteTierBoardEntity = this.getRemotePullConflictPayload(
        change,
      ) as TierBoardEntityRecord | null;

      if (!remoteTierBoardEntity) {
        return false;
      }

      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: mergeTierBoardEntitySafely(
          remoteTierBoardEntity,
          queueItem.payload as TierBoardEntityRecord,
        ),
      }));

      if (outcomes.some(({ outcome }) => !outcome.ok)) {
        return false;
      }

      for (const { queueItem, outcome } of outcomes) {
        if (!outcome.ok) {
          return false;
        }

        await this.tierBoardRepo.putEntity(outcome.merged);
        await this.queueRepo.resetForRetry(queueItem.id, outcome.merged, {
          autoMerge: createAutoMergeSnapshot(outcome.mergedFields),
          rotateClientMutationId: true,
        });
      }

      return true;
    }

    return false;
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
