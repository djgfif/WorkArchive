import type {
  WorkRecord,
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

interface WorksListResult {
  statusCounts: Record<WorkStatus, number>;
  totalActiveCount: number;
  totalDeletedCount: number;
  works: WorkRecord[];
}

export type WorksCollectionScope = 'active' | 'trash';

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
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await this.repository.create(work);
    await this.queueRepository.enqueueWorkChange(work, 'create');

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
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(updated);
    await this.queueRepository.enqueueWorkChange(updated, 'update');

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

    await this.queueRepository.enqueueWorkChange(deleted, 'delete');

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

    await this.queueRepository.enqueueWorkChange(restored, 'update');

    return restored;
  }
}

export const worksService = new WorksService();
