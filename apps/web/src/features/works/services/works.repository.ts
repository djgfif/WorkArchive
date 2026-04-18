import type { WorkRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export class WorksRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async create(work: WorkRecord) {
    await this.getDb().works.add(work);

    return work;
  }

  async update(work: WorkRecord) {
    await this.getDb().works.put(work);

    return work;
  }

  async bulkPut(works: WorkRecord[]) {
    if (works.length === 0) {
      return works;
    }

    await this.getDb().works.bulkPut(works);

    return works;
  }

  async getById(id: string) {
    return (await this.getDb().works.get(id)) ?? null;
  }

  async listAll() {
    return this.getDb().works.toArray();
  }

  async listActive() {
    return this.getDb()
      .works.filter((work) => work.deletedAt === null)
      .toArray();
  }

  async softDelete(
    id: string,
    updates: Pick<WorkRecord, 'deletedAt' | 'syncStatus' | 'updatedAt'>,
  ) {
    const db = this.getDb();

    return db.transaction('rw', db.works, async () => {
      const existing = await db.works.get(id);

      if (!existing) {
        return null;
      }

      const deleted = {
        ...existing,
        ...updates,
      };

      await db.works.put(deleted);

      return deleted;
    });
  }
}

export const worksRepository = new WorksRepository();
