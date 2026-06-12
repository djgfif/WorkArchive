import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { SyncWorkPayloadDto } from '../src/modules/sync/payloads/sync-work-payload.dto';
import { buildExistingWorkUpdatePlan } from '../src/modules/sync/services/sync-push.work-update-plan';
import type { WorkAggregate } from '../src/modules/user-records/user-records.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const WORK_ID = '9fcbf92f-6347-4d79-bdf8-9d0d18439c28';
const CATALOG_WORK_ID = '5a739fe2-1d01-4874-bc8e-ee92f6634e9d';

function buildWork(overrides: Partial<WorkAggregate> = {}): WorkAggregate {
  return {
    id: WORK_ID,
    userId: USER_ID,
    catalogWorkId: CATALOG_WORK_ID,
    catalogTitleId: WORK_ID,
    status: WorkStatus.planned,
    rating: null,
    shortReview: '',
    review: '',
    personalTags: [],
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    catalogWork: {
      id: CATALOG_WORK_ID,
      type: WorkType.novel,
      title: 'Old Title',
      author: '',
      genres: [],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    },
    catalogTitle: null,
    ...overrides,
  } as WorkAggregate;
}

function buildPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
  return {
    id: WORK_ID,
    type: WorkType.novel,
    title: '  Updated Title  ',
    author: '  Author  ',
    genres: ['판타지', '회귀'],
    personalTags: ['즐겨찾기'],
    description: '  Updated description  ',
    thumbnailUrl: ' https://image.example/cover.jpg ',
    status: WorkStatus.completed,
    rating: 4.5,
    shortReview: '  Short  ',
    review: '  Full  ',
    favorite: true,
    progressCurrent: 3,
    progressTotal: 10,
    progressUnit: 'episode',
    lastConsumedLabel: '  3화  ',
    startedAt: '2026-04-18T00:00:00.000Z',
    completedAt: '2026-04-19T00:00:00.000Z',
    droppedAt: null,
    lastConsumedAt: '2026-04-19T01:00:00.000Z',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-19T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'pending',
    serverVersion: 1,
    ...overrides,
  };
}

describe('buildExistingWorkUpdatePlan', () => {
  it('builds catalog and user record mutation data for active updates', () => {
    const plan = buildExistingWorkUpdatePlan(buildWork(), buildPayload());

    expect(plan).toEqual(
      expect.objectContaining({
        catalogWorkId: CATALOG_WORK_ID,
        resultCode: 'applied_change',
        resultMessage: 'Queued change applied on the server.',
        userRecordId: WORK_ID,
      }),
    );
    expect(plan.catalogUpdateData).toEqual({
      author: 'Author',
      description: 'Updated description',
      genres: ['판타지'],
      thumbnailUrl: 'https://image.example/cover.jpg',
      title: 'Updated Title',
      type: WorkType.novel,
    });
    expect(plan.userRecordUpdateData).toEqual(
      expect.objectContaining({
        favorite: true,
        lastConsumedLabel: '3화',
        personalTags: ['즐겨찾기', '회귀'],
        progressCurrent: 3,
        progressTotal: 10,
        progressUnit: 'episode',
        rating: 4.5,
        review: 'Full',
        shortReview: 'Short',
        status: WorkStatus.completed,
        syncStatus: WorkSyncStatus.synced,
      }),
    );
    expect(plan.userRecordUpdateData.serverVersion).toEqual({ increment: 1 });
  });

  it('marks tombstone updates with the tombstone result contract', () => {
    const plan = buildExistingWorkUpdatePlan(
      buildWork(),
      buildPayload({
        deletedAt: '2026-04-20T00:00:00.000Z',
      }),
    );

    expect(plan).toEqual(
      expect.objectContaining({
        resultCode: 'applied_tombstone',
        resultMessage: 'Queued tombstone applied on the server.',
      }),
    );
    expect(plan.userRecordUpdateData).toEqual(
      expect.objectContaining({
        deletedAt: new Date('2026-04-20T00:00:00.000Z'),
      }),
    );
  });
});
