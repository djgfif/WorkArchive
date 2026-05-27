import type { SyncQueueItemRecord, SyncQueuePayload } from '@work-archive/shared-types';

import {
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';
import type { PullCycleResult } from './sync-pull.service';
import type { SyncLeaseContext } from './sync-lease.service';

export const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';
export const SYNC_STALE_STATUS_AT_KEY = 'sync.staleStatusAt';
export const SYNC_STALE_STATUS_REASON_KEY = 'sync.staleStatusReason';

const SYNC_FRESH_PULL_WINDOW_MS = 2 * 60_000;

function getNowIso() {
  return new Date().toISOString();
}

function getPayloadServerVersion(payload: SyncQueuePayload) {
  return 'serverVersion' in payload ? payload.serverVersion : 0;
}

export function isRemoteBackedQueueItem(item: SyncQueueItemRecord) {
  return getPayloadServerVersion(item.payload) > 0;
}

export function isFreshPull(lastSuccessfulPullAt: string | null) {
  if (!lastSuccessfulPullAt) {
    return false;
  }

  const pulledAtMs = Date.parse(lastSuccessfulPullAt);

  return (
    Number.isFinite(pulledAtMs) &&
    Date.now() - pulledAtMs <= SYNC_FRESH_PULL_WINDOW_MS
  );
}

export class SyncStalePolicyService {
  constructor(private readonly metaRepo: AppMetaRepository = appMetaRepository) {}

  async setStaleStatus(reason: string) {
    await Promise.all([
      this.metaRepo.setValue(SYNC_STALE_STATUS_AT_KEY, getNowIso()),
      this.metaRepo.setValue(SYNC_STALE_STATUS_REASON_KEY, reason),
    ]);
  }

  async clearStaleStatus() {
    await Promise.all([
      this.metaRepo.removeValue(SYNC_STALE_STATUS_AT_KEY),
      this.metaRepo.removeValue(SYNC_STALE_STATUS_REASON_KEY),
    ]);
  }

  async ensureFreshPullBeforePush(
    queueItems: SyncQueueItemRecord[],
    identity: SyncLeaseContext,
    pullRemoteChangesWithLease: (
      identity: SyncLeaseContext,
    ) => Promise<PullCycleResult>,
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

    const pull = await pullRemoteChangesWithLease(identity);

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
}

export const syncStalePolicyService = new SyncStalePolicyService();
