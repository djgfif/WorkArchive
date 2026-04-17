import Dexie, { type Table } from 'dexie';

import type { WorkRecord } from '@work-archive/shared-types';

export class WorkArchiveDatabase extends Dexie {
  works!: Table<WorkRecord, string>;

  constructor(name = 'work-archive-db') {
    super(name);

    this.version(1).stores({
      works: 'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
    });
  }
}

export function createWorkArchiveDb(name?: string) {
  return new WorkArchiveDatabase(name);
}

export const workArchiveDb = createWorkArchiveDb();

export async function clearWorkArchiveDb() {
  await workArchiveDb.transaction('rw', workArchiveDb.works, async () => {
    await workArchiveDb.works.clear();
  });
}
