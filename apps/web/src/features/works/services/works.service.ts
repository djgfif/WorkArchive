import type {
  WorkRecord,
  ProgressUnit,
  WorkStatus,
  WorkSyncStatus,
} from '@work-archive/shared-types';
import type { WorksRepository } from './works.repository';

import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/services/sync-queue.repository';
import { queryWorks, type WorksListQuery } from '../utils/query-works';
import type { UpsertWorkInput } from '../utils/work-form';
import { worksRepository } from './works.repository';

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

function getCreateSource(input: UpsertWorkInput) {
  return input.catalogTitleId || input.importDraft
    ? 'quick_add'
    : 'manual_create';
}

interface WorksListResult {
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  totalActiveCount: number;
  totalDeletedCount: number;
  works: WorkRecord[];
}

export type WorksCollectionScope = 'active' | 'trash';

interface UpdateProgressInput {
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: ProgressUnit | null;
  lastConsumedLabel?: string | null;
}

function buildEmptyStatusCounts(): Record<WorkStatus, number> {
  return {
    completed: 0,
    dropped: 0,
    in_progress: 0,
    paused: 0,
    planned: 0,
  };
}

function countStatuses(works: WorkRecord[]) {
  return works.reduce((counts, work) => {
    counts[work.status] += 1;

    return counts;
  }, buildEmptyStatusCounts());
}

export class WorksService {
  constructor(
    private readonly repository: WorksRepository = worksRepository,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
  ) {}

  async listWorks(
    query: WorksListQuery,
    scope: WorksCollectionScope = 'active',
  ) {
    const allWorks = await this.repository.listAll();
    const activeWorks = allWorks.filter((work) => work.deletedAt === null);
    const deletedWorks = allWorks.filter((work) => work.deletedAt !== null);
    const worksInScope = scope === 'trash' ? deletedWorks : activeWorks;

    return {
      statusCounts: countStatuses(activeWorks),
      tagSuggestions: Array.from(
        new Set(activeWorks.flatMap((work) => work.personalTags)),
      ).sort((left, right) => left.localeCompare(right)),
      totalActiveCount: activeWorks.length,
      totalDeletedCount: deletedWorks.length,
      works: queryWorks(worksInScope, query),
    } satisfies WorksListResult;
  }

  async getWorkById(id: string) {
    const work = await this.repository.getById(id);

    if (!work || work.deletedAt !== null) {
      return null;
    }

    return work;
  }

  async createWork(input: UpsertWorkInput) {
    const now = new Date().toISOString();
    const work: WorkRecord = {
      id: crypto.randomUUID(),
      ...input,
      catalogTitleId: input.catalogTitleId ?? null,
      importDraft: input.importDraft ?? null,
      personalTags: [...(input.personalTags ?? [])],
      createdAt: now,
      updatedAt: now,
      progressCurrent: null,
      progressTotal: null,
      progressUnit: null,
      lastConsumedLabel: null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      droppedAt: input.droppedAt ?? null,
      lastConsumedAt: input.lastConsumedAt ?? null,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await this.repository.create(work);
    await this.queueRepository.enqueueWorkChange(
      work,
      'create',
      getCreateSource(input),
    );

    return work;
  }

  async updateWork(id: string, input: UpsertWorkInput) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('작품을 찾을 수 없습니다.');
    }

    const updated: WorkRecord = {
      ...existing,
      ...input,
      catalogTitleId:
        input.catalogTitleId === undefined
          ? (existing.catalogTitleId ?? null)
          : input.catalogTitleId,
      importDraft:
        input.importDraft === undefined
          ? (existing.importDraft ?? null)
          : input.importDraft,
      personalTags: [...(input.personalTags ?? existing.personalTags)],
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      droppedAt: input.droppedAt ?? null,
      lastConsumedAt: input.lastConsumedAt ?? null,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(updated);
    await this.queueRepository.enqueueWorkChange(updated, 'update', 'edit_form');

    return updated;
  }

  async updateProgress(id: string, input: UpdateProgressInput) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('작품을 찾을 수 없습니다.');
    }

    const updated: WorkRecord = {
      ...existing,
      lastConsumedLabel:
        input.lastConsumedLabel === undefined
          ? (existing.lastConsumedLabel ?? null)
          : (input.lastConsumedLabel?.trim() ?? null),
      lastConsumedAt: new Date().toISOString(),
      progressCurrent:
        input.progressCurrent === undefined
          ? (existing.progressCurrent ?? null)
          : input.progressCurrent,
      progressTotal:
        input.progressTotal === undefined
          ? (existing.progressTotal ?? null)
          : input.progressTotal,
      progressUnit:
        input.progressUnit === undefined
          ? (existing.progressUnit ?? null)
          : input.progressUnit,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(updated);
    await this.queueRepository.enqueueWorkChange(
      updated,
      'update',
      'progress_update',
    );

    return updated;
  }

  async deleteWork(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('작품을 찾을 수 없습니다.');
    }

    const deletedAt = new Date().toISOString();
    const deleted = await this.repository.softDelete(id, {
      deletedAt,
      updatedAt: deletedAt,
      syncStatus: getNextSyncStatus(existing.serverVersion),
    });

    if (!deleted) {
      throw new Error('작품을 찾을 수 없습니다.');
    }

    await this.queueRepository.enqueueWorkChange(deleted, 'delete', 'edit_form');

    return deleted;
  }

  async restoreWork(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt === null) {
      throw new Error('복원할 작품을 찾을 수 없습니다.');
    }

    const restoredAt = new Date().toISOString();
    const restored = await this.repository.restore(id, {
      deletedAt: null,
      syncStatus: getNextSyncStatus(existing.serverVersion),
      updatedAt: restoredAt,
    });

    if (!restored) {
      throw new Error('복원할 작품을 찾을 수 없습니다.');
    }

    await this.queueRepository.enqueueWorkChange(restored, 'update', 'restore');

    return restored;
  }
}

export const worksService = new WorksService();
