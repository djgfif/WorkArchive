import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  getWorkArchiveDbName,
} from '../../works/storage';
import { AppMetaRepository } from '../../sync/queue';
import { WorksRepository } from '../../works';
import { worksService } from '../../works';
import { createUpsertWorkInputFromRecord } from '../../works';

const REVIEWED_FINGERPRINT_KEY_PREFIX = 'auth.guestTransfer.reviewedFingerprint:';

export interface GuestTransferReviewItem {
  duplicateCandidates: WorkRecord[];
  guestWork: WorkRecord;
  hasDuplicates: boolean;
}

export interface GuestTransferReviewData {
  duplicateCount: number;
  fingerprint: string;
  items: GuestTransferReviewItem[];
  totalActiveCount: number;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function buildFingerprint(works: WorkRecord[]) {
  return works
    .map((work) => `${work.id}:${work.updatedAt}:${work.deletedAt ?? 'active'}`)
    .sort()
    .join('|');
}

export class GuestTransferService {
  async getPendingReview(userId: string): Promise<GuestTransferReviewData | null> {
    const guestDb = createWorkArchiveDb(
      getWorkArchiveDbName({
        kind: 'guest',
      }),
    );
    const userDb = createWorkArchiveDb(
      getWorkArchiveDbName({
        kind: 'user',
        userId,
      }),
    );

    try {
      const guestWorksRepository = new WorksRepository(() => guestDb);
      const userWorksRepository = new WorksRepository(() => userDb);
      const guestMetaRepository = new AppMetaRepository(() => guestDb);
      const guestWorks = await guestWorksRepository.listActive();

      if (guestWorks.length === 0) {
        return null;
      }

      const fingerprint = buildFingerprint(guestWorks);
      const lastReviewedFingerprint = await guestMetaRepository.getValue(
        `${REVIEWED_FINGERPRINT_KEY_PREFIX}${userId}`,
      );

      if (lastReviewedFingerprint === fingerprint) {
        return null;
      }

      const userWorks = await userWorksRepository.listActive();
      const items = guestWorks.map((guestWork) => {
        const duplicateCandidates = userWorks.filter(
          (userWork) =>
            userWork.type === guestWork.type &&
            normalizeTitle(userWork.title) === normalizeTitle(guestWork.title),
        );

        return {
          duplicateCandidates,
          guestWork,
          hasDuplicates: duplicateCandidates.length > 0,
        };
      });

      return {
        duplicateCount: items.filter((item) => item.hasDuplicates).length,
        fingerprint,
        items,
        totalActiveCount: guestWorks.length,
      };
    } finally {
      guestDb.close();
      userDb.close();
    }
  }

  async markReviewed(userId: string, fingerprint: string) {
    const guestDb = createWorkArchiveDb(
      getWorkArchiveDbName({
        kind: 'guest',
      }),
    );

    try {
      const guestMetaRepository = new AppMetaRepository(() => guestDb);

      await guestMetaRepository.setValue(
        `${REVIEWED_FINGERPRINT_KEY_PREFIX}${userId}`,
        fingerprint,
      );
    } finally {
      guestDb.close();
    }
  }

  async importSelected(userId: string, fingerprint: string, workIds: string[]) {
    const pendingReview = await this.getPendingReview(userId);

    if (!pendingReview || pendingReview.fingerprint !== fingerprint) {
      throw new Error('게스트 기록 상태가 바뀌었습니다. 다시 검토해주세요.');
    }

    const selectedIds = new Set(workIds);
    const selectedWorks = pendingReview.items
      .filter((item) => selectedIds.has(item.guestWork.id))
      .map((item) => item.guestWork);
    const importedWorks: WorkRecord[] = [];

    for (const work of selectedWorks) {
      importedWorks.push(
        await worksService.createWork(createUpsertWorkInputFromRecord(work)),
      );
    }

    await this.markReviewed(userId, fingerprint);

    return {
      importedCount: importedWorks.length,
      importedWorks,
      skippedCount: pendingReview.totalActiveCount - importedWorks.length,
    };
  }
}

export const guestTransferService = new GuestTransferService();
