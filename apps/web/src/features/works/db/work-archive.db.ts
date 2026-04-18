import Dexie, { type Table } from 'dexie';

import type {
  AppMetaRecord,
  SyncQueueItemRecord,
  WorkRecord,
} from '@work-archive/shared-types';

export class WorkArchiveDatabase extends Dexie {
  works!: Table<WorkRecord, string>;
  syncQueue!: Table<SyncQueueItemRecord<WorkRecord>, string>;
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
  }
}

export function createWorkArchiveDb(name?: string) {
  return new WorkArchiveDatabase(name);
}

export const workArchiveDb = createWorkArchiveDb();

export async function clearWorkArchiveDb() {
  await workArchiveDb.transaction(
    'rw',
    workArchiveDb.works,
    workArchiveDb.syncQueue,
    workArchiveDb.appMeta,
    async () => {
      await workArchiveDb.works.clear();
      await workArchiveDb.syncQueue.clear();
      await workArchiveDb.appMeta.clear();
    },
  );
}
