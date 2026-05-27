import type {
  PushSyncResponse,
  PushSyncResult,
  SyncQueueItemRecord,
  SyncResultCode,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';
import { SYNC_SCHEMA_VERSION } from '@work-archive/shared-types';

import { requestAuthenticatedApiJson } from '@shared/services/api-client';
import {
  localizeServerMessage,
  localizeSyncResultCode,
} from '@shared/utils/localize-message';
import {
  graphRepository,
  releaseRecordsRepository,
  timelineEntriesRepository,
  worksRepository,
  type GraphRepository,
  type ReleaseRecordsRepository,
  type TimelineEntriesRepository,
  type WorksRepository,
} from '@features/works/data';
import {
  tierBoardRepository,
  type TierBoardRepository,
} from '@features/tier-boards/data';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';
import {
  syncLeaseService,
  type SyncLeaseService,
  type SyncLeaseContext,
} from './sync-lease.service';
import {
  syncStalePolicyService,
  type SyncStalePolicyService,
} from './sync-stale-policy.service';
import {
  canAutoMergePushResult,
  createAutoMergeSnapshot,
  getRemoteConflictPayload,
  isGraphEntityType,
  isTierBoardEntityType,
  syncAutoMergeService,
  type GraphEntityRecord,
  type SyncAutoMergeService,
  type TierBoardEntityRecord,
} from './sync-auto-merge.service';
import {
  syncConflictResolutionService,
  type SyncConflictResolutionService,
} from './sync-conflict-resolution.service';
import {
  syncPullService,
  type PullCycleResult,
  type SyncPullService,
} from './sync-pull.service';

export interface PushCycleResult {
  attemptedCount: number;
  appliedCount: number;
  conflictCount: number;
  failedCount: number;
  processedAt: string | null;
  messages: string[];
  requestFailed: boolean;
}

function isDatabaseClosedError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'DatabaseClosedError' ||
      error.message.includes('Database has been closed'))
  );
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

function getRunnableQueueItems(queueItems: SyncQueueItemRecord[]) {
  return queueItems.filter(
    (item) => !item.conflict && !shouldWaitForQueueBackoff(item),
  );
}

function assertSupportedResponseSchemaVersion(schemaVersion: unknown) {
  if (schemaVersion === SYNC_SCHEMA_VERSION) {
    return;
  }

  throw new Error(
    '보내기 응답의 동기화 계약 버전을 지원하지 않습니다. 앱을 새로고침하거나 업데이트해주세요.',
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

export class SyncPushService {
  constructor(
    private readonly worksRepo: WorksRepository = worksRepository,
    private readonly releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly queueRepo: SyncQueueRepository = syncQueueRepository,
    private readonly timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
    private readonly tierBoardRepo: TierBoardRepository = tierBoardRepository,
    private readonly leaseService: SyncLeaseService = syncLeaseService,
    private readonly stalePolicyService: SyncStalePolicyService = syncStalePolicyService,
    private readonly pullService: SyncPullService = syncPullService,
    private readonly autoMergeService: SyncAutoMergeService = syncAutoMergeService,
    private readonly conflictService: SyncConflictResolutionService = syncConflictResolutionService,
  ) {}

  async pushQueuedChanges(): Promise<PushCycleResult> {
    return this.leaseService.withSyncLease(
      'push',
      () => this.buildPushLeaseBusyResult(),
      (identity) => this.pushQueuedChangesWithLease(identity),
    );
  }

  buildPushLeaseBusyResult(): PushCycleResult {
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

  async pushQueuedChangesWithLease(
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
    const backoffCount =
      queueItems.length - manualReviewCount - runnableQueueItems.length;

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

    const freshnessResult = await this.stalePolicyService.ensureFreshPullBeforePush(
      runnableQueueItems,
      identity,
      (leaseIdentity) => this.pullService.pullRemoteChangesWithLease(leaseIdentity),
    );

    if (freshnessResult) {
      return this.handleFreshnessResult(
        freshnessResult,
        runnableQueueItems,
        identity,
      );
    }

    const queueItemIds = runnableQueueItems.map((item) => item.id);
    const queueItemsById = new Map(
      runnableQueueItems.map((item) => [item.id, item]),
    );

    try {
      await this.leaseService.extendActiveSyncLease(identity);
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

      assertSupportedResponseSchemaVersion(response.schemaVersion);
      await this.leaseService.extendActiveSyncLease(identity);

      const appliedQueueIds: string[] = [];
      let appliedCount = 0;
      let conflictCount = 0;
      let failedCount = 0;
      const messages: string[] = [];

      for (const result of response.results) {
        await this.leaseService.extendActiveSyncLease(identity);
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
            getRemoteConflictPayload(result),
            result.code,
          );
          await this.conflictService.markEntitySyncStatus(
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

  private handleFreshnessResult(
    freshnessResult: PullCycleResult,
    runnableQueueItems: SyncQueueItemRecord[],
    identity: SyncLeaseContext,
  ): Promise<PushCycleResult> | PushCycleResult {
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

  private async applySuccessfulPushResult(
    queueItem: SyncQueueItemRecord,
    result: PushSyncResult,
  ) {
    try {
      if (isGraphEntityType(result.entityType)) {
        const remoteGraphEntity = getRemoteConflictPayload(
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
        const remoteTierBoardEntity = getRemoteConflictPayload(
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

    const remote = getRemoteConflictPayload(result);

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
        const outcome = this.autoMergeService.mergeGraphEntitySafely(
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
        const outcome = this.autoMergeService.mergeTierBoardEntitySafely(
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
        const outcome = this.autoMergeService.mergeReleaseRecordSafely(
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
        const outcome = this.autoMergeService.mergeTimelineEntrySafely(
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
      const outcome = this.autoMergeService.mergeWorkSafely(
        remote as WorkRecord,
        localWork,
      );

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

export const syncPushService = new SyncPushService();
