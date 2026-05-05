import type {
  SyncOperation,
  SyncQueueSource,
  TimelineEntryRecord,
  TimelineEntryType,
} from '@work-archive/shared-types';

import { syncQueueRepository } from '../../sync/services/sync-queue.repository';
import { timelineEntriesRepository } from './timeline-entries.repository';

export interface CreateTimelineEntryInput {
  workId: string;
  type: TimelineEntryType;
  occurredAt: string;
  note: string;
}

export class TimelineEntriesService {
  constructor(
    private readonly repository = timelineEntriesRepository,
    private readonly queueRepository = syncQueueRepository,
  ) {}

  listByWorkId(workId: string) {
    return this.repository.listByWorkId(workId);
  }

  async createTimelineEntry(input: CreateTimelineEntryInput) {
    const entry = await this.repository.create(input);

    await this.enqueueTimelineEntry(entry, 'create');

    return entry;
  }

  async deleteTimelineEntry(id: string) {
    const deleted = await this.repository.softDelete(id);

    if (deleted) {
      await this.enqueueTimelineEntry(deleted, 'delete');
    }

    return deleted;
  }

  async enqueueTimelineEntry(
    entry: TimelineEntryRecord,
    operation: SyncOperation,
    source: SyncQueueSource = 'timeline_entry_update',
  ) {
    if (entry.deletedAt !== null && entry.serverVersion === 0) {
      return this.queueRepository.enqueueTimelineEntryChange(
        entry,
        operation,
        source,
      );
    }

    const queuedEntry: TimelineEntryRecord = {
      ...entry,
      syncStatus: 'pending',
    };

    await this.repository.update(queuedEntry);

    return this.queueRepository.enqueueTimelineEntryChange(
      queuedEntry,
      operation,
      source,
    );
  }
}

export const timelineEntriesService = new TimelineEntriesService();
