import type {
  SyncQueueItemRecord,
  WorkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import { requestAuthenticatedApiJson } from '../../auth/services/auth.api';
import {
  worksRepository,
  type WorksRepository,
} from '../../works/services/works.repository';
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

type PushResultStatus = 'applied' | 'conflict' | 'failed';
type PullOperation = 'upsert' | 'delete';
export type SyncRunState = 'idle' | 'syncing' | 'success' | 'failed';

interface PushSyncResult {
  queueId: string;
  entityId: string;
  entityType: 'work';
  status: PushResultStatus;
  message: string;
  work: WorkRecord | null;
}

interface PushSyncResponse {
  processedAt: string;
  results: PushSyncResult[];
}

interface PullSyncChange {
  entityType: 'work';
  entityId: string;
  operation: PullOperation;
  work: WorkRecord;
}

interface PullSyncResponse {
  pulledAt: string;
  nextSince: string;
  changes: PullSyncChange[];
}

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
          localizeServerMessage(result.message, '동기화 결과를 확인하지 못했습니다.'),
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

        await this.queueRepo.markFailed(
          result.queueId,
          localizeServerMessage(result.message, '동기화에 실패했습니다.'),
        );

        if (result.status === 'conflict') {
          conflictCount += 1;
          await this.markWorkSyncStatus(result.entityId, 'conflict');
        } else {
          failedCount += 1;
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

      await this.queueRepo.markManyFailed(queueItemIds, message);

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
      const queueItems = await this.queueRepo.listAll();
      const queueItemsByEntityId = new Map<
        string,
        SyncQueueItemRecord<WorkRecord>[]
      >();
      const worksToMerge: WorkRecord[] = [];
      let skippedCount = 0;
      const messages: string[] = [];

      for (const item of queueItems) {
        const itemsForEntity = queueItemsByEntityId.get(item.entityId) ?? [];

        itemsForEntity.push(item);
        queueItemsByEntityId.set(item.entityId, itemsForEntity);
      }

      for (const change of response.changes) {
        if (queuedWorkIds.has(change.entityId)) {
          skippedCount += 1;
          messages.push('다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다.');
          await this.markWorkSyncStatus(change.entityId, 'conflict');

          const relatedQueueItems =
            queueItemsByEntityId.get(change.entityId) ?? [];

          for (const queueItem of relatedQueueItems) {
            await this.queueRepo.setLastError(
              queueItem.id,
              '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다. 내용을 확인한 뒤 다시 동기화해주세요.',
            );
          }

          continue;
        }

        worksToMerge.push(change.work);
      }

      await this.worksRepo.bulkPut(worksToMerge);
      const nextSince = skippedCount > 0 ? since : response.nextSince;

      if (nextSince !== null) {
        await this.metaRepo.setValue(LAST_SUCCESSFUL_PULL_AT_KEY, nextSince);
      }

      if (response.changes.length === 0) {
        messages.push('가져올 변경 사항이 없습니다.');
      } else if (skippedCount > 0) {
        messages.push('확인이 필요한 충돌이 있어 일부 내용은 가져오지 않았습니다.');
      }

      return {
        pulledCount: response.changes.length,
        appliedCount: worksToMerge.length,
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

  private async applySuccessfulPushResult(
    queueItem: SyncQueueItemRecord<WorkRecord>,
    result: PushSyncResult,
  ) {
    try {
      if (result.work !== null) {
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
}

export const syncService = new SyncService();
