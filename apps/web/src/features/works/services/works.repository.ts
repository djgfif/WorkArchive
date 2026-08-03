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
   * work store, automatic timeline entries, and the sync queue, so a work
   * mutation and every derived change commit — or roll back — together. These
   * stores live on the same Dexie instance, so nested repository operations
   * join this transaction.
   */
  runWorkMutation<T>(run: () => Promise<T>): Promise<T> {
    const db = this.getDb();

    return db.transaction(
      'rw',
      [db.works, db.timelineEntries, db.syncQueue],
      run,
    );
  }

  /**
   * Runs a work create or edit together with its graph, automatic timeline,
   * and sync-queue writes. GraphRepository and SyncQueueRepository open
   * compatible nested Dexie transactions, so their work joins this parent
   * transaction and any child failure aborts the complete mutation.
   */
  runWorkAndGraphMutation<T>(run: () => Promise<T>): Promise<T> {
    const db = this.getDb();

    return db.transaction(
      'rw',
      [
        db.works,
        db.timelineEntries,
        db.series,
        db.workSeriesLinks,
        db.contributors,
        db.workContributors,
        db.workRelations,
        db.syncQueue,
      ],
      run,
    );
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

  /**
   * 영구 삭제 — 작품 행과 그 작품이 소유한 로컬 레코드(릴리스·타임라인·시리즈
   * 링크·기여자 링크·관계)를 한 트랜잭션에서 하드 삭제한다. 공유 엔티티
   * (contributors·series)와 티어보드는 다른 작품도 참조하므로 건드리지 않는다.
   * 되돌릴 수 없는 로컬 정리이므로 호출부에서 반드시 확인을 받아야 한다.
   */
  async permanentlyDelete(ids: string[]) {
    if (ids.length === 0) {
      return 0;
    }

    const db = this.getDb();

    await db.transaction(
      'rw',
      [
        db.works,
        db.releaseRecords,
        db.timelineEntries,
        db.workSeriesLinks,
        db.workContributors,
        db.workRelations,
      ],
      async () => {
        await this.cascadeDeleteOwnedRecords(db, ids);
        await db.works.bulkDelete(ids);
      },
    );

    return ids.length;
  }

  private async cascadeDeleteOwnedRecords(
    db: WorkArchiveDatabase,
    ids: string[],
  ) {
    await db.releaseRecords.where('userWorkRecordId').anyOf(ids).delete();
    await db.timelineEntries.where('workId').anyOf(ids).delete();
    await db.workSeriesLinks.where('workId').anyOf(ids).delete();
    await db.workContributors.where('workId').anyOf(ids).delete();
    await db.workRelations.where('sourceWorkId').anyOf(ids).delete();
    await db.workRelations.where('targetWorkId').anyOf(ids).delete();
  }
}

export const worksRepository = new WorksRepository();
