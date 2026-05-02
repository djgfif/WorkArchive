import type {
  PullSyncResponse,
  PullSyncChange,
  PushSyncResponse,
  PushSyncResult,
  SyncQueuePayload,
  SyncQueueItemRecord,
  UserReleaseRecord,
  WorkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

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
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';
import { localizeServerMessage } from '../../../shared/utils/localize-message';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';

const WORK_MERGE_FIELDS = [
  'title',
  'author',
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'tier',
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

function cloneQueuePayload<TPayload extends SyncQueuePayload>(
  payload: TPayload,
): TPayload {
  if ('genres' in payload) {
    return cloneWorkRecord(payload as WorkRecord) as TPayload;
  }

  return cloneReleaseRecord(payload as UserReleaseRecord) as TPayload;
}

function getNowIso() {
  return new Date().toISOString();
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
        changes: queueItems.map((item) => ({
          queueId: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          createdAt: item.createdAt,
          payload: item.payload,
        })),
      });

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
          localizeServerMessage(
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
          const conflictMessage = localizeServerMessage(
            result.message,
            '동기화에 실패했습니다.',
          );

          conflictCount += 1;
          await this.queueRepo.markConflict(
            result.queueId,
            conflictMessage,
            this.getRemoteConflictPayload(result),
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
            localizeServerMessage(result.message, '동기화에 실패했습니다.'),
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
        messages.push('일부 변경 사항의 처리 결과를 확인하지 못했습니다.');
        await this.queueRepo.markFailed(
          queueId,
          '처리 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
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
      const response = await postJson<PullSyncResponse>('/sync/pull', {
        since,
      });
      const queuedWorkIds = new Set(await this.queueRepo.getQueuedWorkIds());
      const queuedReleaseRecordIds = new Set(
        await this.queueRepo.getQueuedReleaseRecordIds(),
      );
      const queueItems = await this.queueRepo.listAll();
      const queueItemsByEntityKey = new Map<string, SyncQueueItemRecord[]>();
      const worksToMerge: WorkRecord[] = [];
      const releaseRecordsToMerge: UserReleaseRecord[] = [];
      let skippedCount = 0;
      const messages: string[] = [];

      for (const item of queueItems) {
        const entityKey = this.getEntityKey(item.entityType, item.entityId);
        const itemsForEntity = queueItemsByEntityKey.get(entityKey) ?? [];

        itemsForEntity.push(item);
        queueItemsByEntityKey.set(entityKey, itemsForEntity);
      }

      for (const change of response.changes) {
        const hasLocalQueue =
          change.entityType === 'work'
            ? queuedWorkIds.has(change.entityId)
            : queuedReleaseRecordIds.has(change.entityId);

        if (hasLocalQueue) {
          skippedCount += 1;
          messages.push(
            '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다.',
          );
          await this.markEntitySyncStatus(
            change.entityType,
            change.entityId,
            'conflict',
          );

          const relatedQueueItems =
            queueItemsByEntityKey.get(
              this.getEntityKey(change.entityType, change.entityId),
            ) ?? [];

          for (const queueItem of relatedQueueItems) {
            await this.queueRepo.setLastError(
              queueItem.id,
              '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다. 내용을 확인한 뒤 다시 동기화해주세요.',
            );
            await this.queueRepo.setConflict(
              queueItem.id,
              '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다. 내용을 확인한 뒤 다시 동기화해주세요.',
              this.getRemotePullConflictPayload(change),
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
        }
      }

      await this.worksRepo.bulkPut(worksToMerge);
      await this.releaseRecordsRepo.bulkPut(releaseRecordsToMerge);
      const nextSince = skippedCount > 0 ? since : response.nextSince;

      if (nextSince !== null) {
        await this.metaRepo.setValue(LAST_SUCCESSFUL_PULL_AT_KEY, nextSince);
      }

      if (response.changes.length === 0) {
        messages.push('가져올 변경 사항이 없습니다.');
      } else if (skippedCount > 0) {
        messages.push(
          '확인이 필요한 충돌이 있어 일부 내용은 가져오지 않았습니다.',
        );
      }

      return {
        pulledCount: response.changes.length,
        appliedCount: worksToMerge.length + releaseRecordsToMerge.length,
        skippedCount,
        pulledAt: response.pulledAt,
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

  private markEntitySyncStatus(
    entityType: 'work' | 'release_record',
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    return entityType === 'work'
      ? this.markWorkSyncStatus(id, syncStatus)
      : this.markReleaseRecordSyncStatus(id, syncStatus);
  }

  private getEntityKey(
    entityType: 'work' | 'release_record',
    entityId: string,
  ) {
    return `${entityType}:${entityId}`;
  }

  private getRemoteConflictPayload(result: PushSyncResult) {
    if (result.entityType === 'release_record') {
      return result.releaseRecord ?? null;
    }

    return result.work ?? null;
  }

  private getRemotePullConflictPayload(change: PullSyncChange) {
    if (change.entityType === 'release_record') {
      return change.releaseRecord ?? null;
    }

    return change.work ?? null;
  }
}

export const syncService = new SyncService();
