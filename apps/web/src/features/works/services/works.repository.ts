import type { WorkRecord } from '@work-archive/shared-types';

import {
  type WorkArchiveDatabase,
  workArchiveDb,
} from '../db/work-archive.db';

export class WorksRepository {
  constructor(private readonly db: WorkArchiveDatabase = workArchiveDb) {}

  async create(work: WorkRecord) {
    await this.db.works.add(work);

    return work;
  }

  async update(work: WorkRecord) {
    await this.db.works.put(work);

    return work;
  }

  async getById(id: string) {
    return (await this.db.works.get(id)) ?? null;
  }

  async listAll() {
    return this.db.works.toArray();
  }

  async listActive() {
    return this.db.works.filter((work) => work.deletedAt === null).toArray();
  }

  async softDelete(
    id: string,
    updates: Pick<WorkRecord, 'deletedAt' | 'syncStatus' | 'updatedAt'>,
  ) {
    return this.db.transaction('rw', this.db.works, async () => {
      const existing = await this.db.works.get(id);

      if (!existing) {
        return null;
      }

      const deleted = {
        ...existing,
        ...updates,
      };

      await this.db.works.put(deleted);

      return deleted;
    });
  }
}

export const worksRepository = new WorksRepository();
