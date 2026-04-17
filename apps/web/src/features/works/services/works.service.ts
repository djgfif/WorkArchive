import type { WorkRecord, WorkSyncStatus } from '@work-archive/shared-types';
import type { WorksRepository } from './works.repository';

import { queryWorks, type WorksListQuery } from '../utils/query-works';
import type { UpsertWorkInput } from '../utils/work-form';
import { worksRepository } from './works.repository';

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

interface WorksListResult {
  totalActiveCount: number;
  works: WorkRecord[];
}

export class WorksService {
  constructor(private readonly repository: WorksRepository = worksRepository) {}

  async listWorks(query: WorksListQuery) {
    const activeWorks = await this.repository.listActive();

    return {
      works: queryWorks(activeWorks, query),
      totalActiveCount: activeWorks.length,
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

    return work;
  }

  async updateWork(id: string, input: UpsertWorkInput) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('Work not found.');
    }

    const updated: WorkRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(updated);

    return updated;
  }

  async deleteWork(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('Work not found.');
    }

    const deletedAt = new Date().toISOString();
    const deleted = await this.repository.softDelete(id, {
      deletedAt,
      updatedAt: deletedAt,
      syncStatus: getNextSyncStatus(existing.serverVersion),
    });

    if (!deleted) {
      throw new Error('Work not found.');
    }

    return deleted;
  }
}

export const worksService = new WorksService();
