import Dexie from 'dexie';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import type { WorksListQuery } from '../utils/query-works';

type DatabaseResolver = () => WorkArchiveDatabase;
type WorkDeletedAtScope = 'active' | 'deleted';
type StoredWorkRecord = WorkRecord & {
  _deletedAtScope: WorkDeletedAtScope;
};

function getDeletedAtScope(
  work: Pick<WorkRecord, 'deletedAt'>,
): WorkDeletedAtScope {
  return work.deletedAt === null ? 'active' : 'deleted';
}

function normalizeWorkRecord(work: WorkRecord | StoredWorkRecord): WorkRecord {
  const { _deletedAtScope: _localOnlyIndex, ...rest } =
    work as StoredWorkRecord;

  return {
    ...rest,
    startedAt: rest.startedAt ?? null,
    completedAt: rest.completedAt ?? null,
    droppedAt: rest.droppedAt ?? null,
    lastConsumedAt: rest.lastConsumedAt ?? null,
    genres: Array.isArray(rest.genres) ? [...rest.genres] : [],
    personalTags: Array.isArray((rest as Partial<WorkRecord>).personalTags)
      ? [...rest.personalTags]
      : [],
  };
}

function prepareStoredWorkRecord(work: WorkRecord): StoredWorkRecord {
  const normalizedWork = normalizeWorkRecord(work);

  return {
    ...normalizedWork,
    _deletedAtScope: getDeletedAtScope(normalizedWork),
  };
}

export class WorksRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  /**
   * Runs `run` inside a single read-write transaction that spans the local
   * work store and the sync queue, so a work mutation and its enqueued change
   * commit — or roll back — together. The sync queue lives on the same Dexie
   * instance, so its own transactions nest into this one.
   */
  runWorkMutation<T>(run: () => Promise<T>): Promise<T> {
    const db = this.getDb();

    return db.transaction('rw', [db.works, db.syncQueue], run);
  }

  async create(work: WorkRecord) {
    const storedWork = prepareStoredWorkRecord(work);

    await this.getDb().works.add(storedWork);

    return normalizeWorkRecord(storedWork);
  }

  async update(work: WorkRecord) {
    const storedWork = prepareStoredWorkRecord(work);

    await this.getDb().works.put(storedWork);

    return normalizeWorkRecord(storedWork);
  }

  async bulkPut(works: WorkRecord[]) {
    if (works.length === 0) {
      return works;
    }

    const storedWorks = works.map(prepareStoredWorkRecord);

    await this.getDb().works.bulkPut(storedWorks);

    return storedWorks.map(normalizeWorkRecord);
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
        .works.where('_deletedAtScope')
        .equals('active')
        .toArray()
    ).map(normalizeWorkRecord);
  }

  async listDeleted() {
    return (
      await this.getDb()
        .works.where('_deletedAtScope')
        .equals('deleted')
        .toArray()
    ).map(normalizeWorkRecord);
  }

  async countByScope(scope: WorkDeletedAtScope) {
    return this.getDb().works.where('_deletedAtScope').equals(scope).count();
  }

  async listByScopeForQuery(
    scope: WorkDeletedAtScope,
    query: Pick<WorksListQuery, 'sortBy' | 'status' | 'type'>,
  ) {
    const db = this.getDb();

    if (query.status !== 'all') {
      return (
        await db.works
          .where('[_deletedAtScope+status]')
          .equals([scope, query.status])
          .toArray()
      ).map(normalizeWorkRecord);
    }

    if (query.type !== 'all') {
      return (
        await db.works
          .where('[_deletedAtScope+type]')
          .equals([scope, query.type])
          .toArray()
      ).map(normalizeWorkRecord);
    }

    if (query.sortBy === 'updatedAt') {
      return (
        await db.works
          .where('[_deletedAtScope+updatedAt]')
          .between([scope, Dexie.minKey], [scope, Dexie.maxKey])
          .reverse()
          .toArray()
      ).map(normalizeWorkRecord);
    }

    return (
      await db.works.where('_deletedAtScope').equals(scope).toArray()
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
        _deletedAtScope: getDeletedAtScope(updates),
      };

      await db.works.put(deleted);

      return normalizeWorkRecord(deleted);
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
        _deletedAtScope: getDeletedAtScope(updates),
      };

      await db.works.put(restored);

      return normalizeWorkRecord(restored);
    });
  }
}

export const worksRepository = new WorksRepository();
