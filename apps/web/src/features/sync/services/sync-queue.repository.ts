import type {
  SyncConflictSnapshot,
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  SyncResultCode,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

const WORK_ENTITY_TYPE = 'work';
const RELEASE_RECORD_ENTITY_TYPE = 'release_record';

type DatabaseResolver = () => WorkArchiveDatabase;

export class SyncQueueRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async enqueueWorkChange(
    work: WorkRecord,
    operation: SyncOperation,
    source: SyncQueueSource = 'unknown',
  ) {
    return this.enqueueChange(
      WORK_ENTITY_TYPE,
      work,
      operation,
      {
        ...work,
        genres: [...work.genres],
        personalTags: [...work.personalTags],
      },
      source,
    );
  }

  async enqueueReleaseRecordChange(
    releaseRecord: UserReleaseRecord,
    operation: SyncOperation,
    source: SyncQueueSource = 'release_record_update',
  ) {
    return this.enqueueChange(
      RELEASE_RECORD_ENTITY_TYPE,
      releaseRecord,
      operation,
      {
        ...releaseRecord,
      },
      source,
    );
  }

  private async enqueueChange<TPayload extends WorkRecord | UserReleaseRecord>(
    entityType: typeof WORK_ENTITY_TYPE | typeof RELEASE_RECORD_ENTITY_TYPE,
    entity: TPayload,
    operation: SyncOperation,
    payload: TPayload,
    source: SyncQueueSource,
  ) {
    const db = this.getDb();

    return db.transaction('rw', db.syncQueue, async () => {
      const existingItems = await db.syncQueue
        .where('[entityType+entityId]')
        .equals([entityType, entity.id])
        .toArray();

      if (existingItems.length > 0) {
        await db.syncQueue.bulkDelete(existingItems.map((item) => item.id));
      }

      const hasUnsyncedCreate = existingItems.some(
        (item) => item.operation === 'create',
      );

      if (
        entity.deletedAt !== null &&
        (hasUnsyncedCreate || entity.serverVersion === 0)
      ) {
        return null;
      }

      const nextOperation =
        hasUnsyncedCreate || entity.serverVersion === 0 ? 'create' : operation;

      const queueItem: SyncQueueItemRecord<TPayload> = {
        id: crypto.randomUUID(),
        entityType,
        entityId: entity.id,
        operation: nextOperation,
        payload,
        source,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
        conflict: null,
      };

      await db.syncQueue.add(queueItem);

      return queueItem;
    });
  }

  async listAll() {
    const items = await this.getDb().syncQueue.orderBy('createdAt').toArray();

    return items.map((item) => ({
      ...item,
      source: item.source ?? 'unknown',
    }));
  }

  async getById(id: string) {
    const item = await this.getDb().syncQueue.get(id);

    return item ? { ...item, source: item.source ?? 'unknown' } : null;
  }

  async removeMany(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    await this.getDb().syncQueue.bulkDelete(ids);
  }

  async markFailed(id: string, lastError: string) {
    const existing = await this.getDb().syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord = {
      ...existing,
      retryCount: existing.retryCount + 1,
      lastError,
      conflict: null,
    };

    await this.getDb().syncQueue.put(updated);

    return updated;
  }

  async setLastError(id: string, lastError: string) {
    const existing = await this.getDb().syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord = {
      ...existing,
      lastError,
    };

    await this.getDb().syncQueue.put(updated);

    return updated;
  }

  async markManyFailed(ids: string[], lastError: string) {
    if (ids.length === 0) {
      return [];
    }

    const db = this.getDb();

    return db.transaction('rw', db.syncQueue, async () => {
      const updatedItems: SyncQueueItemRecord[] = [];

      for (const id of ids) {
        const item = await db.syncQueue.get(id);

        if (!item) {
          continue;
        }

        const updated: SyncQueueItemRecord = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError,
          conflict: null,
        };

        await db.syncQueue.put(updated);
        updatedItems.push(updated);
      }

      return updatedItems;
    });
  }

  async hasQueuedWork(entityId: string) {
    const db = this.getDb();

    return (
      (await db.syncQueue
        .where('[entityType+entityId]')
        .equals([WORK_ENTITY_TYPE, entityId])
        .count()) > 0
    );
  }

  async getQueuedWorkIds() {
    const queueItems = await this.getDb().syncQueue.toArray();

    return Array.from(
      new Set(
        queueItems
          .filter((item) => item.entityType === WORK_ENTITY_TYPE)
          .map((item) => item.entityId),
      ),
    );
  }

  async getQueuedReleaseRecordIds() {
    const queueItems = await this.getDb().syncQueue.toArray();

    return Array.from(
      new Set(
        queueItems
          .filter((item) => item.entityType === RELEASE_RECORD_ENTITY_TYPE)
          .map((item) => item.entityId),
      ),
    );
  }

  async markConflict<TPayload extends SyncQueuePayload>(
    id: string,
    lastError: string,
    remote: TPayload | null,
    code?: SyncResultCode,
  ) {
    const existing = await this.getDb().syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord = {
      ...existing,
      retryCount: existing.retryCount + 1,
      lastError,
      conflict: {
        ...(code ? { code } : {}),
        detectedAt: new Date().toISOString(),
        message: lastError,
        remote,
      } satisfies SyncConflictSnapshot,
    };

    await this.getDb().syncQueue.put(updated);

    return updated;
  }

  async setConflict<TPayload extends SyncQueuePayload>(
    id: string,
    lastError: string,
    remote: TPayload | null,
    code?: SyncResultCode,
  ) {
    const existing = await this.getDb().syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord = {
      ...existing,
      lastError,
      conflict: {
        ...(code ? { code } : {}),
        detectedAt: new Date().toISOString(),
        message: lastError,
        remote,
      } satisfies SyncConflictSnapshot,
    };

    await this.getDb().syncQueue.put(updated);

    return updated;
  }

  async resetForRetry<TPayload extends SyncQueuePayload>(
    id: string,
    payload: TPayload,
  ) {
    const existing = await this.getDb().syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord<TPayload> = {
      ...existing,
      payload,
      retryCount: 0,
      lastError: null,
      conflict: null,
    };

    await this.getDb().syncQueue.put(updated);

    return updated;
  }
}

export const syncQueueRepository = new SyncQueueRepository();
