import type { WorkRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

function normalizeWorkRecord(work: WorkRecord): WorkRecord {
  return {
    ...work,
    startedAt: work.startedAt ?? null,
    completedAt: work.completedAt ?? null,
    droppedAt: work.droppedAt ?? null,
    lastConsumedAt: work.lastConsumedAt ?? null,
    genres: Array.isArray(work.genres) ? [...work.genres] : [],
    personalTags: Array.isArray((work as Partial<WorkRecord>).personalTags)
      ? [...work.personalTags]
      : [],
  };
}

export class WorksRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async create(work: WorkRecord) {
    const normalizedWork = normalizeWorkRecord(work);

    await this.getDb().works.add(normalizedWork);

    return normalizedWork;
  }

  async update(work: WorkRecord) {
    const normalizedWork = normalizeWorkRecord(work);

    await this.getDb().works.put(normalizedWork);

    return normalizedWork;
  }

  async bulkPut(works: WorkRecord[]) {
    if (works.length === 0) {
      return works;
    }

    const normalizedWorks = works.map(normalizeWorkRecord);

    await this.getDb().works.bulkPut(normalizedWorks);

    return normalizedWorks;
  }

  async getById(id: string) {
    const work = await this.getDb().works.get(id);

    return work ? normalizeWorkRecord(work) : null;
  }

  async listAll() {
    return (await this.getDb().works.toArray()).map(normalizeWorkRecord);
  }

  async listActive() {
    return (
      await this.getDb()
        .works.filter((work) => work.deletedAt === null)
        .toArray()
    ).map(normalizeWorkRecord);
  }

  async listDeleted() {
    return (
      await this.getDb()
        .works.filter((work) => work.deletedAt !== null)
        .toArray()
    ).map(normalizeWorkRecord);
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

  async restore(
    id: string,
    updates: Pick<WorkRecord, 'deletedAt' | 'syncStatus' | 'updatedAt'>,
  ) {
    const db = this.getDb();

    return db.transaction('rw', db.works, async () => {
      const existing = await db.works.get(id);

      if (!existing) {
        return null;
      }

      const restored = {
        ...existing,
        ...updates,
      };

      await db.works.put(restored);

      return restored;
    });
  }
}

export const worksRepository = new WorksRepository();
