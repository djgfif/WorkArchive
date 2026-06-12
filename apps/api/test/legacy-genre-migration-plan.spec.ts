import { describe, expect, it } from '@jest/globals';

import { buildLegacyGenreMigrationWorkPlan } from '../src/operations/legacy-genre-migration-plan';

describe('legacy genre migration plan', () => {
  it('moves unknown and overflow genres into affected user records', () => {
    expect(
      buildLegacyGenreMigrationWorkPlan({
        id: 'work-1',
        genres: ['회귀', '판타지', '빙의', '로맨스', '드라마', '액션'],
        userRecords: [
          {
            id: 'record-1',
            personalTags: ['완독'],
          },
          {
            id: 'record-2',
            personalTags: ['회귀', '빙의', '액션'],
          },
        ],
      }),
    ).toEqual({
      catalogWorkId: 'work-1',
      changedCatalogWork: true,
      changedUserRecords: [
        {
          id: 'record-1',
          personalTags: ['완독', '회귀', '빙의', '액션'],
        },
      ],
      genres: ['판타지', '로맨스', '드라마'],
      movedTags: ['회귀', '빙의', '액션'],
    });
  });

  it('marks already normalized works as unchanged', () => {
    expect(
      buildLegacyGenreMigrationWorkPlan({
        id: 'work-1',
        genres: ['판타지', 'SF'],
        userRecords: [
          {
            id: 'record-1',
            personalTags: ['완독'],
          },
        ],
      }),
    ).toEqual({
      catalogWorkId: 'work-1',
      changedCatalogWork: false,
      changedUserRecords: [],
      genres: ['판타지', 'SF'],
      movedTags: [],
    });
  });
});
