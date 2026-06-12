import { BadRequestException } from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { WorkAggregate } from '../src/modules/user-records/user-records.service';
import {
  buildWorkCreateCompatibilityPlan,
  buildWorkUpdateCompatibilityPlan,
} from '../src/modules/works/work-compatibility.mapper';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';

function buildWork(overrides: Partial<WorkAggregate> = {}): WorkAggregate {
  return {
    id: 'work-1',
    userId: USER_ID,
    catalogWorkId: 'work-1',
    catalogTitleId: null,
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    personalTags: ['기존 태그'],
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    catalogWork: {
      id: 'work-1',
      type: WorkType.novel,
      title: '기본 작품',
      author: '기본 작가',
      genres: ['판타지'],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    catalogTitle: null,
    ...overrides,
  } as WorkAggregate;
}

describe('work compatibility mutation plans', () => {
  it('builds the flat create plan with normalized catalog and record data', () => {
    const plan = buildWorkCreateCompatibilityPlan(USER_ID, 'work-1', {
      title: '  Dune  ',
      author: '  Frank Herbert ',
      genres: ['판타지', '회귀'],
      personalTags: ['완독'],
    });

    expect(plan.catalogCreateData).toEqual(
      expect.objectContaining({
        author: 'Frank Herbert',
        genres: ['판타지'],
        title: 'Dune',
        type: WorkType.novel,
      }),
    );
    expect(plan.userRecordCreateData).toEqual(
      expect.objectContaining({
        catalogTitleId: 'work-1',
        catalogWorkId: 'work-1',
        personalTags: ['완독', '회귀'],
        serverVersion: 1,
        syncStatus: WorkSyncStatus.synced,
        userId: USER_ID,
      }),
    );
  });

  it('rejects blank create titles before building mutation data', () => {
    expect(() =>
      buildWorkCreateCompatibilityPlan(USER_ID, 'work-1', {
        title: '   ',
      }),
    ).toThrow(BadRequestException);
  });

  it('builds update plans with change flags and taxonomy carry-over', () => {
    const plan = buildWorkUpdateCompatibilityPlan(buildWork(), {
      genres: ['판타지', '빙의'],
      personalTags: ['새 태그'],
    });

    expect(plan.hasCatalogChanges).toBe(true);
    expect(plan.hasUserRecordChanges).toBe(true);
    expect(plan.catalogUpdateData).toEqual({
      genres: ['판타지'],
    });
    expect(plan.userRecordUpdateData).toEqual({
      personalTags: ['새 태그', '빙의'],
    });
  });

  it('marks empty update payloads as no-op', () => {
    const plan = buildWorkUpdateCompatibilityPlan(buildWork(), {});

    expect(plan.hasCatalogChanges).toBe(false);
    expect(plan.hasUserRecordChanges).toBe(false);
    expect(plan.catalogUpdateData).toEqual({});
    expect(plan.userRecordUpdateData).toEqual({});
  });
});
