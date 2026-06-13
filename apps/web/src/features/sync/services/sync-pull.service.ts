import type {
  ContributorRecord,
  PullSyncChange,
  PullSyncResponse,
  SeriesRecord,
  SyncQueueItemRecord,
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
} from '@work-archive/shared-types';
import { SYNC_SCHEMA_VERSION } from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import {
  ApiRequestError,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';
import { localizeServerMessage } from '@shared/utils/localize-message';
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
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';
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
  LAST_SUCCESSFUL_PULL_AT_KEY,
  syncStalePolicyService,
  type SyncStalePolicyService,
} from './sync-stale-policy.service';
import {
  createAutoMergeSnapshot,
  getRemotePullConflictPayload,
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

const PULL_PAGE_LIMIT = 500;

export interface PullCycleResult {
  pulledCount: number;
  appliedCount: number;
  skippedCount: number;
  pulledAt: string | null;
  nextSince: string | null;
  messages: string[];
  requestFailed: boolean;
  retryAfterMs?: number;
}

function assertSupportedResponseSchemaVersion(schemaVersion: unknown) {
  if (schemaVersion === SYNC_SCHEMA_VERSION) {
    return;
  }

  throw new Error(appI18n.t('sync.schemaPullUnsupported'));
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
      missingTokenMessage: appI18n.t('sync.loginRequired'),
    },
  );
}

function getEntityKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

export class SyncPullService {
  constructor(
    private readonly worksRepo: WorksRepository = worksRepository,
    private readonly releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly queueRepo: SyncQueueRepository = syncQueueRepository,
    private readonly metaRepo: AppMetaRepository = appMetaRepository,
    private readonly timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
    private readonly tierBoardRepo: TierBoardRepository = tierBoardRepository,
    private readonly leaseService: SyncLeaseService = syncLeaseService,
    private readonly stalePolicyService: SyncStalePolicyService = syncStalePolicyService,
    private readonly autoMergeService: SyncAutoMergeService = syncAutoMergeService,
    private readonly conflictService: SyncConflictResolutionService = syncConflictResolutionService,
  ) {}

  async pullRemoteChanges(): Promise<PullCycleResult> {
    return this.leaseService.withSyncLease(
      'pull',
      () => this.buildPullLeaseBusyResult(),
      (identity) => this.pullRemoteChangesWithLease(identity),
    );
  }

  buildPullLeaseBusyResult(): PullCycleResult {
    return {
      pulledCount: 0,
      appliedCount: 0,
      skippedCount: 0,
      pulledAt: null,
      nextSince: null,
      messages: [appI18n.t('sync.pullLeaseBusy')],
      requestFailed: false,
    };
  }

  async pullRemoteChangesWithLease(
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
        const entityKey = getEntityKey(item.entityType, item.entityId);
        const itemsForEntity = queueItemsByEntityKey.get(entityKey) ?? [];

        itemsForEntity.push(item);
        queueItemsByEntityKey.set(entityKey, itemsForEntity);
      }

      do {
        await this.leaseService.extendActiveSyncLease(identity);
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

        assertSupportedResponseSchemaVersion(response.schemaVersion);
        await this.leaseService.extendActiveSyncLease(identity);
        pulledAt = response.pulledAt;
        pulledCount += response.changes.length;
        nextSince = response.nextSince;

        for (const change of response.changes) {
          const relatedQueueItems =
            queueItemsByEntityKey.get(
              getEntityKey(change.entityType, change.entityId),
            ) ?? [];
          const hasLocalQueue = relatedQueueItems.length > 0;

          if (hasLocalQueue) {
            const autoMerged = await this.autoMergePullChangeWithQueuedPayload(
              change,
              relatedQueueItems,
            );

            if (!autoMerged) {
              skippedCount += relatedQueueItems.length;
              const remote = getRemotePullConflictPayload(change);
              const conflictMessage = appI18n.t('sync.conflictLocalQueue');

              for (const queueItem of relatedQueueItems) {
                await this.queueRepo.markConflict(
                  queueItem.id,
                  conflictMessage,
                  remote,
                  'pull_conflict_local_queue',
                );
                await this.conflictService.markEntitySyncStatus(
                  queueItem.entityType,
                  queueItem.entityId,
                  'conflict',
                );
              }
            } else {
              messages.push(appI18n.t('sync.autoMergedRemoteQueued'));
            }

            continue;
          }

          this.collectPullChange(change, {
            contributorsToMerge,
            releaseRecordsToMerge,
            seriesToMerge,
            tierBoardAssetsToMerge,
            tierBoardCardsToMerge,
            tierBoardsToMerge,
            tierLanesToMerge,
            timelineEntriesToMerge,
            workContributorsToMerge,
            workRelationsToMerge,
            workSeriesLinksToMerge,
            worksToMerge,
          });
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
        await this.stalePolicyService.clearStaleStatus();
      }

      if (pulledCount === 0) {
        messages.push(appI18n.t('sync.noChangesToPull'));
      } else if (skippedCount > 0) {
        messages.push(appI18n.t('sync.pullSkippedForConflicts'));
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
      const retryAfterMs =
        error instanceof ApiRequestError ? error.retryAfterMs : null;

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
                appI18n.t('sync.failedPull'),
              )
            : appI18n.t('sync.failedPull'),
        ],
        requestFailed: true,
        ...(retryAfterMs !== null ? { retryAfterMs } : {}),
      };
    }
  }

  private collectPullChange(
    change: PullSyncChange,
    buckets: {
      worksToMerge: WorkRecord[];
      releaseRecordsToMerge: UserReleaseRecord[];
      timelineEntriesToMerge: TimelineEntryRecord[];
      seriesToMerge: SeriesRecord[];
      contributorsToMerge: ContributorRecord[];
      workSeriesLinksToMerge: WorkSeriesLinkRecord[];
      workContributorsToMerge: WorkContributorRecord[];
      workRelationsToMerge: WorkRelationRecord[];
      tierBoardsToMerge: TierBoardRecord[];
      tierLanesToMerge: TierLaneRecord[];
      tierBoardCardsToMerge: TierBoardCardRecord[];
      tierBoardAssetsToMerge: TierBoardAssetRecord[];
    },
  ) {
    if (change.entityType === 'work' && change.work) {
      buckets.worksToMerge.push(change.work);
      return;
    }

    if (change.entityType === 'release_record' && change.releaseRecord) {
      buckets.releaseRecordsToMerge.push(change.releaseRecord);
      return;
    }

    if (change.entityType === 'timeline_entry' && change.timelineEntry) {
      buckets.timelineEntriesToMerge.push(change.timelineEntry);
      return;
    }

    if (change.entityType === 'series' && change.series) {
      buckets.seriesToMerge.push(change.series);
      return;
    }

    if (change.entityType === 'contributor' && change.contributor) {
      buckets.contributorsToMerge.push(change.contributor);
      return;
    }

    if (change.entityType === 'work_series_link' && change.workSeriesLink) {
      buckets.workSeriesLinksToMerge.push(change.workSeriesLink);
      return;
    }

    if (change.entityType === 'work_contributor' && change.workContributor) {
      buckets.workContributorsToMerge.push(change.workContributor);
      return;
    }

    if (change.entityType === 'work_relation' && change.workRelation) {
      buckets.workRelationsToMerge.push(change.workRelation);
      return;
    }

    if (change.entityType === 'tier_board' && change.tierBoard) {
      buckets.tierBoardsToMerge.push(change.tierBoard);
      return;
    }

    if (change.entityType === 'tier_lane' && change.tierLane) {
      buckets.tierLanesToMerge.push(change.tierLane);
      return;
    }

    if (change.entityType === 'tier_board_card' && change.tierBoardCard) {
      buckets.tierBoardCardsToMerge.push(change.tierBoardCard);
      return;
    }

    if (change.entityType === 'tier_board_asset' && change.tierBoardAsset) {
      buckets.tierBoardAssetsToMerge.push(change.tierBoardAsset);
    }
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
        outcome: this.autoMergeService.mergeWorkSafely(
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
        outcome: this.autoMergeService.mergeReleaseRecordSafely(
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
        outcome: this.autoMergeService.mergeTimelineEntrySafely(
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
      const remoteGraphEntity = getRemotePullConflictPayload(
        change,
      ) as GraphEntityRecord | null;

      if (!remoteGraphEntity) {
        return false;
      }

      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: this.autoMergeService.mergeGraphEntitySafely(
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
      const remoteTierBoardEntity = getRemotePullConflictPayload(
        change,
      ) as TierBoardEntityRecord | null;

      if (!remoteTierBoardEntity) {
        return false;
      }

      const outcomes = queueItems.map((queueItem) => ({
        queueItem,
        outcome: this.autoMergeService.mergeTierBoardEntitySafely(
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
}

export const syncPullService = new SyncPullService();
