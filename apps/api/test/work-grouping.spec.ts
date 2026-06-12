import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { WorkAggregate } from '../src/modules/user-records/user-records.service';
import { groupWorksBy } from '../src/modules/works/work-grouping';

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
    personalTags: [],
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
      genres: [],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    catalogTitle: null,
    ...overrides,
  } as WorkAggregate;
}

describe('groupWorksBy', () => {
  it('groups flat work responses by status and preserves counts', () => {
    const groups = groupWorksBy(
      [
        buildWork({ id: 'work-1', status: WorkStatus.completed }),
        buildWork({ id: 'work-2', status: WorkStatus.completed }),
        buildWork({ id: 'work-3', status: WorkStatus.planned }),
      ],
      'status',
    );

    expect(groups).toEqual([
      expect.objectContaining({
        count: 2,
        key: WorkStatus.completed,
        label: WorkStatus.completed,
      }),
      expect.objectContaining({
        count: 1,
        key: WorkStatus.planned,
        label: WorkStatus.planned,
      }),
    ]);
  });

  it('prefers catalog title medium and franchise metadata when present', () => {
    const groups = groupWorksBy(
      [
        buildWork({
          catalogTitleId: 'catalog-title-1',
          catalogTitle: {
            id: 'catalog-title-1',
            mediumType: WorkType.web_novel,
            displayTitle: '카탈로그 제목',
            summary: '',
            thumbnailUrl: '',
            franchise: {
              id: 'franchise-1',
              displayName: '은하 연대기',
            },
            contributors: [],
          } as never,
        }),
      ],
      'medium',
    );

    expect(groups).toEqual([
      expect.objectContaining({
        key: WorkType.web_novel,
        label: WorkType.web_novel,
        works: [
          expect.objectContaining({
            catalogTitleId: 'catalog-title-1',
            title: '카탈로그 제목',
            type: WorkType.web_novel,
          }),
        ],
      }),
    ]);

    expect(
      groupWorksBy(
        [
          buildWork({
            catalogTitle: {
              id: 'catalog-title-1',
              mediumType: WorkType.novel,
              displayTitle: '카탈로그 제목',
              summary: '',
              thumbnailUrl: '',
              franchise: {
                id: 'franchise-1',
                displayName: '은하 연대기',
              },
              contributors: [],
            } as never,
          }),
        ],
        'franchise',
      ),
    ).toEqual([
      expect.objectContaining({
        key: 'franchise-1',
        label: '은하 연대기',
      }),
    ]);
  });

  it('uses stable fallback labels for missing franchise and contributor data', () => {
    expect(groupWorksBy([buildWork()], 'franchise')).toEqual([
      expect.objectContaining({
        key: 'unfranchised',
        label: '프랜차이즈 미지정',
      }),
    ]);

    expect(
      groupWorksBy(
        [
          buildWork({
            catalogWork: {
              ...buildWork().catalogWork,
              author: '',
            },
          }),
        ],
        'contributor',
      ),
    ).toEqual([
      expect.objectContaining({
        key: 'unknown-contributor',
        label: '기여자 미지정',
      }),
    ]);
  });
});
