import type {
  SyncOperation,
  SyncQueueItemRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  type WorkArchiveDatabase,
  workArchiveDb,
} from '../../works/db/work-archive.db';

const WORK_ENTITY_TYPE = 'work';

export class SyncQueueRepository {
  constructor(private readonly db: WorkArchiveDatabase = workArchiveDb) {}

  async enqueueWorkChange(work: WorkRecord, operation: SyncOperation) {
    return this.db.transaction('rw', this.db.syncQueue, async () => {
      const existingItems = await this.db.syncQueue
        .where('[entityType+entityId]')
        .equals([WORK_ENTITY_TYPE, work.id])
        .toArray();

      if (existingItems.length > 0) {
        await this.db.syncQueue.bulkDelete(
          existingItems.map((item) => item.id),
        );
      }

      const hasUnsyncedCreate = existingItems.some(
        (item) => item.operation === 'create',
      );

      if (
        work.deletedAt !== null &&
        (hasUnsyncedCreate || work.serverVersion === 0)
      ) {
        return null;
      }

      const nextOperation =
        hasUnsyncedCreate || work.serverVersion === 0 ? 'create' : operation;

      const queueItem: SyncQueueItemRecord<WorkRecord> = {
        id: crypto.randomUUID(),
        entityType: WORK_ENTITY_TYPE,
        entityId: work.id,
        operation: nextOperation,
        payload: {
          ...work,
          genres: [...work.genres],
        },
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
      };

      await this.db.syncQueue.add(queueItem);

      return queueItem;
    });
  }

  async listAll() {
    return this.db.syncQueue.orderBy('createdAt').toArray();
  }

  async getById(id: string) {
    return (await this.db.syncQueue.get(id)) ?? null;
  }

  async removeMany(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    await this.db.syncQueue.bulkDelete(ids);
  }

  async markFailed(id: string, lastError: string) {
    const existing = await this.db.syncQueue.get(id);

    if (!existing) {
      return null;
    }

    const updated: SyncQueueItemRecord<WorkRecord> = {
      ...existing,
      retryCount: existing.retryCount + 1,
      lastError,
    };

    await this.db.syncQueue.put(updated);

    return updated;
  }

  async markManyFailed(ids: string[], lastError: string) {
    if (ids.length === 0) {
      return [];
    }

    return this.db.transaction('rw', this.db.syncQueue, async () => {
      const updatedItems: SyncQueueItemRecord<WorkRecord>[] = [];

      for (const id of ids) {
        const item = await this.db.syncQueue.get(id);

        if (!item) {
          continue;
        }

        const updated: SyncQueueItemRecord<WorkRecord> = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError,
        };

        await this.db.syncQueue.put(updated);
        updatedItems.push(updated);
      }

      return updatedItems;
    });
  }

  async hasQueuedWork(entityId: string) {
    return (
      (await this.db.syncQueue
        .where('[entityType+entityId]')
        .equals([WORK_ENTITY_TYPE, entityId])
        .count()) > 0
    );
  }

  async getQueuedWorkIds() {
    const queueItems = await this.db.syncQueue.toArray();

    return Array.from(
      new Set(
        queueItems
          .filter((item) => item.entityType === WORK_ENTITY_TYPE)
          .map((item) => item.entityId),
      ),
    );
  }
}

export const syncQueueRepository = new SyncQueueRepository();
