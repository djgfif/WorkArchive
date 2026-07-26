import Dexie, { type Table } from 'dexie';

import type {
  AppMetaRecord,
  ContributorRecord,
  SeriesRecord,
  SyncEntityType,
  SyncQueueItemRecord,
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRecord,
  WorkSeriesLinkRecord,
  WorkRelationRecord,
} from '@work-archive/shared-types';
import { clearPosterImageCache } from '@shared/services/poster-image-cache';

import {
  migratePausedStatusToDropped,
  migratePrefixedTagsToGraph,
  migrateTierBoardDraftSchema,
  migrateTierBoards,
  type StoredTierBoardAssetRecord,
} from './work-archive.migrations';

const DEFAULT_DB_NAME = 'work-archive-db-guest';

export type ArchiveScope =
  | {
      kind: 'guest';
    }
  | {
      kind: 'user';
      userId: string;
    };

export interface ConflictRecoverySnapshotRecord {
  afterEntity: unknown;
  afterQueue: SyncQueueItemRecord | null;
  beforeEntity: unknown;
  beforeQueue: SyncQueueItemRecord;
  createdAt: string;
  entityId: string;
  entityType: SyncEntityType;
  expiresAt: string;
  id: string;
  queueItemId: string;
}

const knownDatabaseNames = new Set<string>();
const knownDatabaseInstances = new Set<WorkArchiveDatabase>();

export class WorkArchiveDatabase extends Dexie {
  works!: Table<WorkRecord, string>;
  releaseRecords!: Table<UserReleaseRecord, string>;
  timelineEntries!: Table<TimelineEntryRecord, string>;
  series!: Table<SeriesRecord, string>;
  workSeriesLinks!: Table<WorkSeriesLinkRecord, string>;
  contributors!: Table<ContributorRecord, string>;
  workContributors!: Table<WorkContributorRecord, string>;
  workRelations!: Table<WorkRelationRecord, string>;
  tierBoards!: Table<TierBoardRecord, string>;
  tierLanes!: Table<TierLaneRecord, string>;
  tierBoardCards!: Table<TierBoardCardRecord, string>;
  tierBoardAssets!: Table<StoredTierBoardAssetRecord, string>;
  syncQueue!: Table<SyncQueueItemRecord, string>;
  appMeta!: Table<AppMetaRecord, string>;
  conflictRecovery!: Table<ConflictRecoverySnapshotRecord, string>;

  constructor(name = 'work-archive-db') {
    super(name);

    this.version(1).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
    });

    this.version(2).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(3).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
      releaseRecords:
        'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(4)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord, string>('works')
          .toCollection()
          .modify((work) => {
            if (!Array.isArray(work.personalTags)) {
              work.personalTags = [];
            }
          }),
      );

    this.version(5)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord, string>('works')
          .toCollection()
          .modify((work) => {
            work.startedAt ??= null;
            work.completedAt ??= null;
            work.droppedAt ??= null;
            work.lastConsumedAt ??= null;
          }),
      );

    this.version(6)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<SyncQueueItemRecord, string>('syncQueue')
          .toCollection()
          .modify((item) => {
            item.source ??= 'unknown';
          }),
      );

    this.version(7)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord & { _deletedAtScope?: string }, string>('works')
          .toCollection()
          .modify((work) => {
            work._deletedAtScope =
              work.deletedAt === null ? 'active' : 'deleted';
          }),
      );

    this.version(8).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
      releaseRecords:
        'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
      timelineEntries:
        'id, workId, type, occurredAt, deletedAt, [workId+occurredAt], [deletedAt+occurredAt]',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(9)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<TimelineEntryRecord, string>('timelineEntries')
          .toCollection()
          .modify((entry) => {
            entry.syncStatus ??= 'local-only';
            entry.serverVersion ??= 0;
          }),
      );

    this.version(10)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migratePrefixedTagsToGraph(transaction));

    this.version(11)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migratePausedStatusToDropped(transaction));

    this.version(12)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        tierBoards: 'id, title, updatedAt, deletedAt, syncStatus',
        tierLanes:
          'id, boardId, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+orderIndex]',
        tierBoardCards:
          'id, boardId, laneId, workId, cardSourceType, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+laneId+orderIndex], [boardId+deletedAt], [workId+deletedAt]',
        tierBoardAssets:
          'id, boardId, cardId, deletedAt, updatedAt, [boardId+deletedAt], [cardId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migrateTierBoards(transaction));

    this.version(13)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        tierBoards:
          'id, slug, title, boardType, visibility, updatedAt, deletedAt, syncStatus',
        tierLanes:
          'id, boardId, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+orderIndex]',
        tierBoardCards:
          'id, boardId, laneId, workId, cardSourceType, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+laneId+orderIndex], [boardId+deletedAt], [workId+deletedAt]',
        tierBoardAssets:
          'id, boardId, cardId, storageType, updatedAt, deletedAt, [boardId+deletedAt], [cardId+deletedAt]',
        tierBoardLanes:
          'id, boardId, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+orderIndex]',
        tierBoardItems:
          'id, boardId, laneId, linkedWorkId, sourceType, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+laneId+orderIndex], [boardId+deletedAt], [linkedWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migrateTierBoardDraftSchema(transaction));

    this.version(14)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        tierBoards:
          'id, slug, title, boardType, visibility, updatedAt, deletedAt, syncStatus',
        tierLanes:
          'id, boardId, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+orderIndex]',
        tierBoardCards:
          'id, boardId, laneId, workId, cardSourceType, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+laneId+orderIndex], [boardId+deletedAt], [workId+deletedAt]',
        tierBoardAssets:
          'id, boardId, cardId, storageType, updatedAt, deletedAt, [boardId+deletedAt], [cardId+deletedAt]',
        tierBoardLanes:
          'id, boardId, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+orderIndex]',
        tierBoardItems:
          'id, boardId, laneId, linkedWorkId, sourceType, orderIndex, updatedAt, deletedAt, syncStatus, [boardId+laneId+orderIndex], [boardId+deletedAt], [linkedWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<SyncQueueItemRecord, string>('syncQueue')
          .toCollection()
          .modify((item) => {
            item.clientMutationId ??= crypto.randomUUID();
          }),
      );

    this.version(15).stores({
      conflictRecovery: 'id, queueItemId, entityType, entityId, expiresAt',
    });
  }
}

function registerDatabaseName(name: string) {
  knownDatabaseNames.add(name);

  return name;
}

export function getWorkArchiveDbName(scope: ArchiveScope) {
  return scope.kind === 'guest'
    ? DEFAULT_DB_NAME
    : `work-archive-db-user-${scope.userId}`;
}

export function createWorkArchiveDb(name = DEFAULT_DB_NAME) {
  const database = new WorkArchiveDatabase(registerDatabaseName(name));

  knownDatabaseInstances.add(database);

  return database;
}

class WorkArchiveDbManager {
  private currentScope: ArchiveScope = {
    kind: 'guest',
  };

  private currentDb = createWorkArchiveDb();

  getCurrentDb() {
    return this.currentDb;
  }

  getCurrentScopeKey() {
    return getWorkArchiveDbName(this.currentScope);
  }

  switchToGuest() {
    this.switchScope({
      kind: 'guest',
    });
  }

  switchToUser(userId: string) {
    this.switchScope({
      kind: 'user',
      userId,
    });
  }

  reset() {
    this.currentDb.close();
    this.currentScope = {
      kind: 'guest',
    };
    this.currentDb = createWorkArchiveDb();
  }

  private switchScope(nextScope: ArchiveScope) {
    const nextDatabaseName = getWorkArchiveDbName(nextScope);

    if (this.currentDb.name === nextDatabaseName) {
      this.currentScope = nextScope;

      return;
    }

    this.currentDb.close();
    this.currentScope = nextScope;
    this.currentDb = createWorkArchiveDb(nextDatabaseName);
  }
}

export const workArchiveDbManager = new WorkArchiveDbManager();

export function getWorkArchiveDb() {
  return workArchiveDbManager.getCurrentDb();
}

export async function clearWorkArchiveDb(db = getWorkArchiveDb()) {
  await db.transaction(
    'rw',
    [
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
      db.appMeta,
      db.conflictRecovery,
    ],
    async () => {
      await db.works.clear();
      await db.releaseRecords.clear();
      await db.timelineEntries.clear();
      await db.series.clear();
      await db.workSeriesLinks.clear();
      await db.contributors.clear();
      await db.workContributors.clear();
      await db.workRelations.clear();
      await db.tierBoards.clear();
      await db.tierLanes.clear();
      await db.tierBoardCards.clear();
      await db.tierBoardAssets.clear();
      await db.syncQueue.clear();
      await db.appMeta.clear();
      await db.conflictRecovery.clear();
    },
  );
}

export async function resetWorkArchiveStorage() {
  const databaseNames = [...knownDatabaseNames];

  for (const database of knownDatabaseInstances) {
    database.close();
  }

  for (const databaseName of databaseNames) {
    const database = new WorkArchiveDatabase(databaseName);

    database.close();
    await database.delete();
  }

  knownDatabaseNames.clear();
  knownDatabaseInstances.clear();
  workArchiveDbManager.reset();
  await clearPosterImageCache();
}
