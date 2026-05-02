import Dexie, { type Table } from 'dexie';

import type {
  AppMetaRecord,
  SyncQueueItemRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

const DEFAULT_DB_NAME = 'work-archive-db-guest';

export type ArchiveScope =
  | {
      kind: 'guest';
    }
  | {
      kind: 'user';
      userId: string;
    };

const knownDatabaseNames = new Set<string>();
const knownDatabaseInstances = new Set<WorkArchiveDatabase>();

export class WorkArchiveDatabase extends Dexie {
  works!: Table<WorkRecord, string>;
  releaseRecords!: Table<UserReleaseRecord, string>;
  syncQueue!: Table<SyncQueueItemRecord, string>;
  appMeta!: Table<AppMetaRecord, string>;

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
    db.works,
    db.releaseRecords,
    db.syncQueue,
    db.appMeta,
    async () => {
      await db.works.clear();
      await db.releaseRecords.clear();
      await db.syncQueue.clear();
      await db.appMeta.clear();
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
}
