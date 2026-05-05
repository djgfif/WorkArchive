import Dexie from 'dexie';
import type {
  TimelineEntryRecord,
  TimelineEntryType,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export interface CreateTimelineEntryInput {
  workId: string;
  type: TimelineEntryType;
  occurredAt: string;
  note: string;
}

export class TimelineEntriesRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async listByWorkId(workId: string) {
    const entries = await this.getDb()
      .timelineEntries.where('[workId+occurredAt]')
      .between([workId, Dexie.minKey], [workId, Dexie.maxKey])
      .reverse()
      .toArray();

    return entries.filter((entry) => entry.deletedAt === null);
  }

  async getById(id: string) {
    return (await this.getDb().timelineEntries.get(id)) ?? null;
  }

  async create(input: CreateTimelineEntryInput) {
    const now = new Date().toISOString();
    const entry: TimelineEntryRecord = {
      createdAt: now,
      deletedAt: null,
      id: crypto.randomUUID(),
      note: input.note.trim(),
      occurredAt: input.occurredAt,
      serverVersion: 0,
      syncStatus: 'local-only',
      type: input.type,
      updatedAt: now,
      workId: input.workId,
    };

    await this.getDb().timelineEntries.add(entry);

    return entry;
  }

  async softDelete(id: string) {
    const db = this.getDb();

    return db.transaction('rw', db.timelineEntries, async () => {
      const existing = await db.timelineEntries.get(id);

      if (!existing) {
        return null;
      }

      const now = new Date().toISOString();
      const deleted: TimelineEntryRecord = {
        ...existing,
        deletedAt: now,
        syncStatus: existing.serverVersion === 0 ? 'local-only' : 'pending',
        updatedAt: now,
      };

      await db.timelineEntries.put(deleted);

      return deleted;
    });
  }

  async bulkImport(entries: TimelineEntryRecord[]) {
    if (entries.length === 0) {
      return entries;
    }

    await this.getDb().timelineEntries.bulkPut(entries);

    return entries;
  }

  async update(entry: TimelineEntryRecord) {
    await this.getDb().timelineEntries.put(entry);

    return entry;
  }

  async bulkPut(entries: TimelineEntryRecord[]) {
    if (entries.length === 0) {
      return entries;
    }

    await this.getDb().timelineEntries.bulkPut(entries);

    return entries;
  }
}

export const timelineEntriesRepository = new TimelineEntriesRepository();
