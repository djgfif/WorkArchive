import { describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  getWorkArchiveDbName,
  workArchiveDbManager,
} from '../../works';
import { WorksRepository } from '../../works';
import { GuestTransferService } from './guest-transfer.service';

function createWorkRecord(
  id: string,
  overrides: Partial<WorkRecord> = {},
): WorkRecord {
  const now = '2026-04-21T00:00:00.000Z';

  return {
    id,
    type: 'novel',
    title: `work-${id}`,
    author: '',
    genres: [],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('GuestTransferService', () => {
  it('detects duplicate candidates by type + normalized title', async () => {
    const userId = 'user-duplicate';
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
    const guestRepository = new WorksRepository(() => guestDb);
    const userRepository = new WorksRepository(() => userDb);
    const service = new GuestTransferService();

    await guestRepository.create(
      createWorkRecord('guest-1', {
        type: 'anime',
        title: 'Frieren (2023)',
      }),
    );
    await guestRepository.create(
      createWorkRecord('guest-2', {
        type: 'novel',
        title: 'Dune',
      }),
    );
    await userRepository.create(
      createWorkRecord('user-1', {
        type: 'anime',
        title: ' frieren ',
      }),
    );

    const review = await service.getPendingReview(userId);

    expect(review).not.toBeNull();
    expect(review?.totalActiveCount).toBe(2);
    expect(review?.duplicateCount).toBe(1);
    expect(
      review?.items.find((item) => item.guestWork.id === 'guest-1')
        ?.duplicateCandidates.length,
    ).toBe(1);
    expect(
      review?.items.find((item) => item.guestWork.id === 'guest-2')
        ?.duplicateCandidates.length,
    ).toBe(0);
  });

  it('imports only selected guest records and marks current fingerprint as reviewed', async () => {
    const userId = 'user-import';
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
    const guestRepository = new WorksRepository(() => guestDb);
    const userRepository = new WorksRepository(() => userDb);
    const service = new GuestTransferService();

    const guestNovel = createWorkRecord('guest-import-1', {
      type: 'novel',
      title: 'Project Hail Mary',
    });
    const guestAnime = createWorkRecord('guest-import-2', {
      type: 'anime',
      title: 'Odd Taxi',
    });

    await guestRepository.create(guestNovel);
    await guestRepository.create(guestAnime);

    workArchiveDbManager.switchToUser(userId);

    const review = await service.getPendingReview(userId);

    expect(review).not.toBeNull();

    const result = await service.importSelected(
      userId,
      review!.fingerprint,
      [guestNovel.id],
    );

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.importedWorks[0]?.title).toBe(guestNovel.title);

    const userWorks = await userRepository.listActive();

    expect(userWorks).toHaveLength(1);
    expect(userWorks[0]?.title).toBe(guestNovel.title);
    expect(userWorks[0]?.id).not.toBe(guestNovel.id);

    const pendingAfterReview = await service.getPendingReview(userId);

    expect(pendingAfterReview).toBeNull();
  });
});
