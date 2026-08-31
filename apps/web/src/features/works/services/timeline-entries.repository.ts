import Dexie from 'dexie';
import type {
  TimelineEntryRecord,
  TimelineEntrySource,
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
  source?: TimelineEntrySource;
}

function normalizeTimelineEntry(entry: TimelineEntryRecord) {
  return {
    ...entry,
    source: entry.source ?? 'manual',
  } satisfies TimelineEntryRecord;
}

export class TimelineEntriesRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async getLatestActiveForWorkIdsBefore(
    workIds: ReadonlySet<string>,
    occurredAtExclusive: string,
  ) {
    if (workIds.size === 0) {
      return null;
    }

    const entry = await this.getDb()
      .timelineEntries.where('occurredAt')
      .below(occurredAtExclusive)
      .reverse()
      .filter(
        (candidate) =>
          candidate.deletedAt === null && workIds.has(candidate.workId),
      )
      .first();

    return entry ? normalizeTimelineEntry(entry) : null;
  }

  async listActiveSince(occurredAtInclusive: string) {
    const entries = await this.getDb()
      .timelineEntries.where('occurredAt')
      .aboveOrEqual(occurredAtInclusive)
      .toArray();

    return entries
      .filter((entry) => entry.deletedAt === null)
      .map(normalizeTimelineEntry);
  }

  async listByWorkId(workId: string) {
    const entries = await this.getDb()
      .timelineEntries.where('[workId+occurredAt]')
      .between([workId, Dexie.minKey], [workId, Dexie.maxKey])
      .reverse()
      .toArray();

    return entries
      .filter((entry) => entry.deletedAt === null)
      .map(normalizeTimelineEntry);
  }

  async listActiveByType(type: TimelineEntryType) {
    const entries = await this.getDb()
      .timelineEntries.where('type')
      .equals(type)
      .toArray();

    return entries
      .filter((entry) => entry.deletedAt === null)
      .map(normalizeTimelineEntry);
  }

  async getById(id: string) {
    const entry = await this.getDb().timelineEntries.get(id);
    return entry ? normalizeTimelineEntry(entry) : null;
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
      source: input.source ?? 'manual',
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
