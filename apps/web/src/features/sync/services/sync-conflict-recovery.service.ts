import type {
  SyncEntityType,
  SyncQueueItemRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
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
  getWorkArchiveDb,
  type ConflictRecoverySnapshotRecord,
  type WorkArchiveDatabase,
} from '@features/works/storage';
import {
  tierBoardRepository,
  type TierBoardRepository,
} from '@features/tier-boards/data';
import {
  type GraphEntityRecord,
  isGraphEntityType,
  isTierBoardEntityType,
  type TierBoardEntityRecord,
} from './sync-auto-merge.service';
import {
  syncConflictResolutionService,
  type SyncConflictResolutionService,
} from './sync-conflict-resolution.service';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';

export const CONFLICT_RECOVERY_WINDOW_MS = 10 * 60 * 1000;

type DatabaseResolver = () => WorkArchiveDatabase;
type ResolutionAction<T> = () => Promise<T>;
type TimestampedEntity = {
  id?: string;
  serverVersion?: number;
  syncStatus?: string;
  updatedAt?: string;
};

function cloneSnapshotValue<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : value;
}

function isSameEntityState(current: unknown, expected: unknown) {
  const currentEntity = current as TimestampedEntity | null;
  const expectedEntity = expected as TimestampedEntity | null;

  if (!currentEntity || !expectedEntity) {
    return currentEntity === expectedEntity;
  }

  return (
    currentEntity.id === expectedEntity.id &&
    currentEntity.updatedAt === expectedEntity.updatedAt &&
    currentEntity.syncStatus === expectedEntity.syncStatus &&
    currentEntity.serverVersion === expectedEntity.serverVersion
  );
}

function isSameQueueState(
  current: SyncQueueItemRecord,
  expected: SyncQueueItemRecord,
) {
  return JSON.stringify(current) === JSON.stringify(expected);
}

export class SyncConflictRecoveryService {
  constructor(
    private readonly resolutionService: SyncConflictResolutionService = syncConflictResolutionService,
    private readonly queueRepo: SyncQueueRepository = syncQueueRepository,
    private readonly worksRepo: WorksRepository = worksRepository,
    private readonly releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
    private readonly tierBoardRepo: TierBoardRepository = tierBoardRepository,
    private readonly getDb: DatabaseResolver = getWorkArchiveDb,
  ) {}

  resolveConflictWithLocal(queueItemId: string) {
    return this.resolveAndSnapshot(queueItemId, () =>
      this.resolutionService.resolveConflictWithLocal(queueItemId),
    );
  }

  resolveConflictWithRemote(queueItemId: string) {
    return this.resolveAndSnapshot(queueItemId, () =>
      this.resolutionService.resolveConflictWithRemote(queueItemId),
    );
  }

  resolveConflictWithMergedFields(
    queueItemId: string,
    selectedFields: readonly string[],
  ) {
    return this.resolveAndSnapshot(queueItemId, () =>
      this.resolutionService.resolveConflictWithMergedFields(
        queueItemId,
        selectedFields,
      ),
    );
  }

  async undoConflictResolution(queueItemId: string) {
    const db = this.getDb();

    return db.transaction('rw', this.getMutationTables(db), async () => {
      const snapshot = await db.conflictRecovery.get(queueItemId);

      if (!snapshot) {
        throw new Error(appI18n.t('sync.conflictRecoveryMissing'));
      }

      if (Date.parse(snapshot.expiresAt) <= Date.now()) {
        await db.conflictRecovery.delete(queueItemId);
        throw new Error(appI18n.t('sync.conflictRecoveryExpired'));
      }

      const currentEntity = await this.getEntity(
        snapshot.entityType,
        snapshot.entityId,
      );
      const currentQueueItems = await db.syncQueue
        .where('[entityType+entityId]')
        .equals([snapshot.entityType, snapshot.entityId])
        .toArray();
      const queueIsUnchanged = snapshot.afterQueue
        ? currentQueueItems.length === 1 &&
          isSameQueueState(currentQueueItems[0]!, snapshot.afterQueue)
        : currentQueueItems.length === 0;

      if (
        !isSameEntityState(currentEntity, snapshot.afterEntity) ||
        !queueIsUnchanged
      ) {
        throw new Error(appI18n.t('sync.conflictRecoveryChanged'));
      }

      await this.putEntity(
        snapshot.entityType,
        cloneSnapshotValue(snapshot.beforeEntity),
      );
      await db.syncQueue.delete(snapshot.queueItemId);
      await db.syncQueue.put(cloneSnapshotValue(snapshot.beforeQueue));
      await db.conflictRecovery.delete(snapshot.id);

      return cloneSnapshotValue(snapshot.beforeEntity);
    });
  }

  private async resolveAndSnapshot<T>(
    queueItemId: string,
    resolve: ResolutionAction<T>,
  ) {
    const db = this.getDb();

    return db.transaction('rw', this.getMutationTables(db), async () => {
      const queueItem = await this.queueRepo.getById(queueItemId);

      if (!queueItem) {
        throw new Error(appI18n.t('sync.conflictQueueMissing'));
      }

      const beforeEntity =
        (await this.getEntity(queueItem.entityType, queueItem.entityId)) ??
        queueItem.payload;
      const result = await resolve();
      const afterEntity =
        (await this.getEntity(queueItem.entityType, queueItem.entityId)) ??
        result;
      const afterQueue = await this.queueRepo.getById(queueItemId);
      const createdAt = new Date();
      const snapshot: ConflictRecoverySnapshotRecord = {
        afterEntity: cloneSnapshotValue(afterEntity),
        afterQueue: cloneSnapshotValue(afterQueue),
        beforeEntity: cloneSnapshotValue(beforeEntity),
        beforeQueue: cloneSnapshotValue(queueItem),
        createdAt: createdAt.toISOString(),
        entityId: queueItem.entityId,
        entityType: queueItem.entityType,
        expiresAt: new Date(
          createdAt.getTime() + CONFLICT_RECOVERY_WINDOW_MS,
        ).toISOString(),
        id: queueItemId,
        queueItemId,
      };

      await db.conflictRecovery
        .where('expiresAt')
        .belowOrEqual(createdAt.toISOString())
        .delete();
      await db.conflictRecovery.put(snapshot);

      return result;
    });
  }

  private getMutationTables(db: WorkArchiveDatabase) {
    return [
      db.works,
      db.releaseRecords,
      db.timelineEntries,
      db.series,
      db.workSeriesLinks,
      db.contributors,
      db.workContributors,
      db.workRelations,
      db.tierBoards,
      db.tierLanes,
      db.tierBoardCards,
      db.tierBoardAssets,
      db.syncQueue,
      db.conflictRecovery,
    ];
  }

  private getEntity(entityType: SyncEntityType, entityId: string) {
    if (entityType === 'work') {
      return this.worksRepo.getById(entityId);
    }

    if (entityType === 'release_record') {
      return this.releaseRecordsRepo.getById(entityId);
    }

    if (entityType === 'timeline_entry') {
      return this.timelineEntriesRepo.getById(entityId);
    }

    if (isGraphEntityType(entityType)) {
      return this.graphRepo.getEntity(entityType, entityId);
    }

    if (isTierBoardEntityType(entityType)) {
      return this.tierBoardRepo.getEntity(entityType, entityId);
    }

    return Promise.resolve(null);
  }

  private putEntity(entityType: SyncEntityType, entity: unknown) {
    if (entityType === 'work') {
      return this.worksRepo.update(entity as WorkRecord);
    }

    if (entityType === 'release_record') {
      return this.releaseRecordsRepo.update(entity as UserReleaseRecord);
    }

    if (entityType === 'timeline_entry') {
      return this.timelineEntriesRepo.update(entity as TimelineEntryRecord);
    }

    if (isGraphEntityType(entityType)) {
      return this.graphRepo.putEntity(entity as GraphEntityRecord);
    }

    if (isTierBoardEntityType(entityType)) {
      return this.tierBoardRepo.putEntity(entity as TierBoardEntityRecord);
    }

    return Promise.reject(new Error(appI18n.t('sync.conflictRecoveryChanged')));
  }
}

export const syncConflictRecoveryService = new SyncConflictRecoveryService();
