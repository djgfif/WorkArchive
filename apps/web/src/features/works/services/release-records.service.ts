import type {
  SyncOperation,
  UserReleaseRecord,
  WorkStatus,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/queue';
import {
  releaseRecordsRepository,
  type ReleaseRecordsRepository,
} from './release-records.repository';

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

interface UpsertReleaseRecordInput {
  userWorkRecordId: string;
  catalogReleaseId: string;
  status?: WorkStatus;
  rating?: number | null;
  shortReview?: string;
  review?: string;
  favorite?: boolean;
}

interface UpdateReleaseRecordInput {
  status?: WorkStatus;
  rating?: number | null;
  shortReview?: string;
  review?: string;
  favorite?: boolean;
}

export class ReleaseRecordsService {
  constructor(
    private readonly repository: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
  ) {}

  listByUserWorkRecord(userWorkRecordId: string) {
    return this.repository.listByUserWorkRecord(userWorkRecordId);
  }

  async upsertReleaseRecord(input: UpsertReleaseRecordInput) {
    const existing = await this.repository.getByUserWorkRecordAndRelease(
      input.userWorkRecordId,
      input.catalogReleaseId,
    );

    if (existing) {
      const updateInput: UpdateReleaseRecordInput = {};

      if (input.favorite !== undefined) {
        updateInput.favorite = input.favorite;
      }

      if (input.rating !== undefined) {
        updateInput.rating = input.rating;
      }

      if (input.review !== undefined) {
        updateInput.review = input.review;
      }

      if (input.shortReview !== undefined) {
        updateInput.shortReview = input.shortReview;
      }

      if (input.status !== undefined) {
        updateInput.status = input.status;
      }

      return this.updateReleaseRecord(existing.id, updateInput);
    }

    const now = new Date().toISOString();
    const record: UserReleaseRecord = {
      id: crypto.randomUUID(),
      userWorkRecordId: input.userWorkRecordId,
      catalogReleaseId: input.catalogReleaseId,
      status: input.status ?? 'planned',
      rating: input.rating ?? null,
      shortReview: input.shortReview?.trim() ?? '',
      review: input.review?.trim() ?? '',
      favorite: input.favorite ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await this.repository.create(record);
    await this.queue(record, 'create');

    return record;
  }

  async updateReleaseRecord(id: string, input: UpdateReleaseRecordInput) {
    const existing = await this.repository.getById(id);

    if (!existing) {
      throw new Error('권별 기록을 찾을 수 없습니다.');
    }

    const updated: UserReleaseRecord = {
      ...existing,
      favorite: input.favorite ?? existing.favorite,
      rating: input.rating === undefined ? existing.rating : input.rating,
      review: input.review?.trim() ?? existing.review,
      shortReview: input.shortReview?.trim() ?? existing.shortReview,
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(updated);
    await this.queue(updated, 'update');

    return updated;
  }

  async deleteReleaseRecord(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error('삭제할 권별 기록을 찾을 수 없습니다.');
    }

    const deletedAt = new Date().toISOString();
    const deleted: UserReleaseRecord = {
      ...existing,
      deletedAt,
      updatedAt: deletedAt,
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(deleted);
    await this.queue(deleted, 'delete');

    return deleted;
  }

  async restoreReleaseRecord(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt === null) {
      throw new Error('복원할 권별 기록을 찾을 수 없습니다.');
    }

    const restored: UserReleaseRecord = {
      ...existing,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.update(restored);
    await this.queue(restored, 'update');

    return restored;
  }

  private queue(record: UserReleaseRecord, operation: SyncOperation) {
    return this.queueRepository.enqueueReleaseRecordChange(record, operation);
  }
}

export const releaseRecordsService = new ReleaseRecordsService();
