import type {
  SyncConflictSnapshot,
  SyncEntityType,
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  SyncResultCode,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

const WORK_ENTITY_TYPE = 'work';
const RELEASE_RECORD_ENTITY_TYPE = 'release_record';
const TIMELINE_ENTRY_ENTITY_TYPE = 'timeline_entry';

const SYNC_PUSH_ORDER: Record<SyncEntityType, number> = {
  work: 0,
  series: 1,
  contributor: 1,
  work_series_link: 2,
  work_contributor: 2,
  work_relation: 2,
  tier_board: 3,
  tier_lane: 4,
  tier_board_card: 5,
  tier_board_asset: 6,
  release_record: 3,
  timeline_entry: 3,
};

type DatabaseResolver = () => WorkArchiveDatabase;

function getPayloadServerVersion(payload: SyncQueuePayload) {
  return 'serverVersion' in payload ? payload.serverVersion : 0;
}

export class SyncQueueRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async enqueueWorkChange(
    work: WorkRecord,
    operation: SyncOperation,
    source: SyncQueueSource = 'unknown',
  ) {
    return this.enqueueEntityChange(
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
    return this.enqueueEntityChange(
      RELEASE_RECORD_ENTITY_TYPE,
      releaseRecord,
      operation,
      {
        ...releaseRecord,
      },
      source,
    );
  }

  async enqueueTimelineEntryChange(
    timelineEntry: TimelineEntryRecord,
    operation: SyncOperation,
    source: SyncQueueSource = 'timeline_entry_update',
  ) {
    return this.enqueueEntityChange(
      TIMELINE_ENTRY_ENTITY_TYPE,
      timelineEntry,
      operation,
      {
        ...timelineEntry,
      },
      source,
    );
  }

  async enqueueEntityChange<TPayload extends SyncQueuePayload>(
    entityType: SyncEntityType,
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
        (hasUnsyncedCreate || getPayloadServerVersion(entity) === 0)
      ) {
        return null;
      }

      const nextOperation =
        hasUnsyncedCreate || getPayloadServerVersion(entity) === 0
          ? 'create'
          : operation;

      const queueItem: SyncQueueItemRecord<TPayload> = {
        id: crypto.randomUUID(),
        clientMutationId:
          existingItems.find((item) => item.clientMutationId)?.clientMutationId ??
          crypto.randomUUID(),
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
    const db = this.getDb();
    const items = await db.syncQueue.orderBy('createdAt').toArray();
    const missingMutationIds = items.filter((item) => !item.clientMutationId);

    if (missingMutationIds.length > 0) {
      await db.transaction('rw', db.syncQueue, async () => {
        for (const item of missingMutationIds) {
          item.clientMutationId = crypto.randomUUID();
          await db.syncQueue.put(item);
        }
      });
    }

    return items
      .map((item) => ({
        ...item,
        source: item.source ?? 'unknown',
      }))
      .sort(
        (left, right) =>
          SYNC_PUSH_ORDER[left.entityType] - SYNC_PUSH_ORDER[right.entityType] ||
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      );
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

  async enqueueEntityChangeInOpenTransaction<TPayload extends SyncQueuePayload>(
    entityType: SyncEntityType,
    entity: TPayload,
    operation: SyncOperation,
    payload: TPayload,
    source: SyncQueueSource,
  ) {
    const db = this.getDb();
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
      (hasUnsyncedCreate || getPayloadServerVersion(entity) === 0)
    ) {
      return null;
    }

    const nextOperation =
      hasUnsyncedCreate || getPayloadServerVersion(entity) === 0
        ? 'create'
        : operation;

    const queueItem: SyncQueueItemRecord<TPayload> = {
      id: crypto.randomUUID(),
      clientMutationId:
        existingItems.find((item) => item.clientMutationId)?.clientMutationId ??
        crypto.randomUUID(),
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

  async getQueuedTimelineEntryIds() {
    const queueItems = await this.getDb().syncQueue.toArray();

    return Array.from(
      new Set(
        queueItems
          .filter((item) => item.entityType === TIMELINE_ENTRY_ENTITY_TYPE)
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
