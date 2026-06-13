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
import { appI18n } from '@app/i18n';
import {
  tierBoardRepository,
  type TierBoardRepository,
} from '@features/tier-boards/data';
import {
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';
import { SyncAutoMergeService } from './sync-auto-merge.service';
import { SyncConflictResolutionService } from './sync-conflict-resolution.service';
import { SyncLeaseService } from './sync-lease.service';
import { SyncPullService, type PullCycleResult } from './sync-pull.service';
import { SyncPushService, type PushCycleResult } from './sync-push.service';
import { SyncStalePolicyService } from './sync-stale-policy.service';

export {
  SYNC_STALE_STATUS_AT_KEY,
  SYNC_STALE_STATUS_REASON_KEY,
} from './sync-stale-policy.service';
export type { PullCycleResult } from './sync-pull.service';
export type { PushCycleResult } from './sync-push.service';

export type SyncRunState = 'idle' | 'syncing' | 'success' | 'failed';

export interface ManualSyncResult {
  completedAt: string;
  state: Exclude<SyncRunState, 'idle' | 'syncing'>;
  push: PushCycleResult;
  pull: PullCycleResult;
}

export class SyncService {
  private readonly conflictService: SyncConflictResolutionService;
  private readonly pullService: SyncPullService;
  private readonly pushService: SyncPushService;

  constructor(
    worksRepo: WorksRepository = worksRepository,
    releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    queueRepo: SyncQueueRepository = syncQueueRepository,
    metaRepo: AppMetaRepository = appMetaRepository,
    timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    graphRepo: GraphRepository = graphRepository,
    tierBoardRepo: TierBoardRepository = tierBoardRepository,
  ) {
    const leaseService = new SyncLeaseService(metaRepo);
    const stalePolicyService = new SyncStalePolicyService(metaRepo);
    const autoMergeService = new SyncAutoMergeService();

    this.conflictService = new SyncConflictResolutionService(
      worksRepo,
      releaseRecordsRepo,
      queueRepo,
      timelineEntriesRepo,
      graphRepo,
      tierBoardRepo,
    );
    this.pullService = new SyncPullService(
      worksRepo,
      releaseRecordsRepo,
      queueRepo,
      metaRepo,
      timelineEntriesRepo,
      graphRepo,
      tierBoardRepo,
      leaseService,
      stalePolicyService,
      autoMergeService,
      this.conflictService,
    );
    this.pushService = new SyncPushService(
      worksRepo,
      releaseRecordsRepo,
      queueRepo,
      timelineEntriesRepo,
      graphRepo,
      tierBoardRepo,
      leaseService,
      stalePolicyService,
      this.pullService,
      autoMergeService,
      this.conflictService,
    );
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
          messages: [appI18n.t('sync.manualPullSkippedAfterPushFailure')],
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

  pushQueuedChanges(): Promise<PushCycleResult> {
    return this.pushService.pushQueuedChanges();
  }

  pullRemoteChanges(): Promise<PullCycleResult> {
    return this.pullService.pullRemoteChanges();
  }

  resolveConflictWithLocal(queueItemId: string) {
    return this.conflictService.resolveConflictWithLocal(queueItemId);
  }

  resolveConflictWithRemote(queueItemId: string) {
    return this.conflictService.resolveConflictWithRemote(queueItemId);
  }

  resolveConflictWithMergedFields(
    queueItemId: string,
    selectedFields: readonly string[],
  ) {
    return this.conflictService.resolveConflictWithMergedFields(
      queueItemId,
      selectedFields,
    );
  }
}

export const syncService = new SyncService();
