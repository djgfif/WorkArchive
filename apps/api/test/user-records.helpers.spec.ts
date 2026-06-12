import { BadRequestException } from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildCatalogTitleInputFromImport,
  buildCreateUserRecordData,
  buildSyncedUserRecordUpdateData,
  buildUserRecordInputFromImport,
  buildUserRecordRecordingPolicy,
  getUserRecordGroupKey,
  getUserRecordMedium,
  parseOptionalUserRecordDtoDate,
} from '../src/modules/user-records/user-records.helpers';
import type { WorkAggregate } from '../src/modules/user-records/user-records.types';

function createWorkAggregate(
  overrides: Partial<WorkAggregate> = {},
): WorkAggregate {
  return {
    catalogTitle: null,
    catalogWork: {
      author: '',
      type: WorkType.novel,
    },
    status: WorkStatus.planned,
    ...overrides,
  } as WorkAggregate;
}

describe('user record helpers', () => {
  it('parses optional DTO dates and rejects invalid date strings', () => {
    expect(
      parseOptionalUserRecordDtoDate('2026-04-18T00:00:00.000Z', 'startedAt'),
    ).toEqual(new Date('2026-04-18T00:00:00.000Z'));
    expect(parseOptionalUserRecordDtoDate(null, 'startedAt')).toBeNull();
    expect(parseOptionalUserRecordDtoDate(undefined, 'startedAt')).toBeNull();
    expect(() =>
      parseOptionalUserRecordDtoDate('not-a-date', 'startedAt'),
    ).toThrow(
      new BadRequestException(
        'startedAt must be a valid ISO 8601 date string.',
      ),
    );
  });

  it('prefers catalog title medium over compatibility catalog work type', () => {
    expect(
      getUserRecordMedium(
        createWorkAggregate({
          catalogTitle: {
            mediumType: WorkType.anime,
          },
          catalogWork: {
            type: WorkType.novel,
          },
        } as Partial<WorkAggregate>),
      ),
    ).toBe(WorkType.anime);
  });

  it('builds recording policy view from medium type', () => {
    expect(buildUserRecordRecordingPolicy(WorkType.webtoon)).toMatchObject({
      mediumType: WorkType.webtoon,
      progressOnly: true,
      releaseRecordsSupported: false,
      webPartSplitEnabled: false,
    });
    expect(buildUserRecordRecordingPolicy(WorkType.novel)).toMatchObject({
      mediumType: WorkType.novel,
      progressOnly: false,
      releaseRecordsSupported: true,
      webPartSplitEnabled: true,
    });
  });

  it('builds grouped record keys for status, medium, franchise, and contributor', () => {
    const record = createWorkAggregate({
      catalogTitle: {
        contributors: [
          {
            contributor: {
              displayName: 'Author Name',
              id: 'contributor-1',
            },
          },
        ],
        franchise: {
          displayName: 'Franchise Name',
          id: 'franchise-1',
        },
        mediumType: WorkType.manga,
      },
      catalogWork: {
        author: 'Fallback Author',
        type: WorkType.novel,
      },
      status: WorkStatus.completed,
    } as Partial<WorkAggregate>);

    expect(getUserRecordGroupKey(record, 'status')).toEqual({
      key: WorkStatus.completed,
      label: WorkStatus.completed,
    });
    expect(getUserRecordGroupKey(record, 'medium')).toEqual({
      key: WorkType.manga,
      label: WorkType.manga,
    });
    expect(getUserRecordGroupKey(record, 'franchise')).toEqual({
      key: 'franchise-1',
      label: 'Franchise Name',
    });
    expect(getUserRecordGroupKey(record, 'contributor')).toEqual({
      key: 'contributor-1',
      label: 'Author Name',
    });
  });

  it('uses stable fallback grouped keys when catalog metadata is missing', () => {
    const record = createWorkAggregate({
      catalogWork: {
        author: '',
        type: WorkType.other,
      },
    } as Partial<WorkAggregate>);

    expect(getUserRecordGroupKey(record, 'franchise')).toEqual({
      key: 'unfranchised',
      label: '프랜차이즈 미지정',
    });
    expect(getUserRecordGroupKey(record, 'contributor')).toEqual({
      key: 'unknown-contributor',
      label: '기여자 미지정',
    });
  });

  it('builds synced update mutation data from partial update DTOs', () => {
    expect(
      buildSyncedUserRecordUpdateData({
        completedAt: '2026-04-18T00:00:00.000Z',
        favorite: true,
        personalTags: [' tag ', 'tag', ''],
        review: '  long review  ',
        shortReview: '  short review  ',
        status: WorkStatus.completed,
      }),
    ).toMatchObject({
      completedAt: new Date('2026-04-18T00:00:00.000Z'),
      favorite: true,
      personalTags: ['tag'],
      review: 'long review',
      serverVersion: {
        increment: 1,
      },
      shortReview: 'short review',
      status: WorkStatus.completed,
      syncStatus: WorkSyncStatus.synced,
    });
  });

  it('builds create record data with normalized optional fields', () => {
    expect(
      buildCreateUserRecordData({
        catalogWorkId: 'catalog-work-1',
        input: {
          completedAt: null,
          favorite: true,
          rating: 4,
          review: '  review  ',
          shortReview: '  short  ',
          status: WorkStatus.completed,
        },
        personalTags: ['tag'],
        recordId: 'record-1',
        userId: 'user-1',
      }),
    ).toMatchObject({
      catalogTitleId: 'record-1',
      catalogWorkId: 'catalog-work-1',
      completedAt: null,
      favorite: true,
      id: 'record-1',
      personalTags: ['tag'],
      rating: 4,
      review: 'review',
      serverVersion: 1,
      shortReview: 'short',
      status: WorkStatus.completed,
      syncStatus: WorkSyncStatus.synced,
      userId: 'user-1',
    });
  });

  it('builds catalog title and user record inputs from import DTOs', () => {
    const input = {
      author: '',
      catalogTitle: 'Catalog Title',
      contributors: [{ name: 'Contributor One' }, { name: 'Contributor Two' }],
      description: 'Summary',
      externalRefs: [
        {
          externalId: 'external-1',
          provider: 'open_library',
        },
      ],
      favorite: true,
      franchiseName: 'Franchise',
      genres: ['Novel'],
      mediumType: WorkType.novel,
      personalTags: ['tag'],
      rating: 5,
      releaseCandidates: [
        {
          displayLabel: 'Vol. 1',
          title: 'Volume 1',
        },
      ],
      releaseYear: 2026,
      review: 'Review',
      shortReview: 'Short',
      status: WorkStatus.completed,
      subType: 'light_novel',
      thumbnailUrl: 'https://example.com/cover.jpg',
      title: '',
    };

    expect(buildCatalogTitleInputFromImport(input)).toMatchObject({
      canonicalTitle: 'Catalog Title',
      contributorNames: ['Contributor One', 'Contributor Two'],
      displayTitle: 'Catalog Title',
      externalRefs: input.externalRefs,
      franchiseName: 'Franchise',
      mediumType: WorkType.novel,
      releaseCandidates: input.releaseCandidates,
      releaseYear: 2026,
      subType: 'light_novel',
      summary: 'Summary',
      thumbnailUrl: 'https://example.com/cover.jpg',
    });
    expect(buildUserRecordInputFromImport(input, 'catalog-title-1')).toEqual({
      author: 'Contributor One, Contributor Two',
      catalogTitleId: 'catalog-title-1',
      description: 'Summary',
      favorite: true,
      genres: ['Novel'],
      personalTags: ['tag'],
      rating: 5,
      review: 'Review',
      shortReview: 'Short',
      status: WorkStatus.completed,
      thumbnailUrl: 'https://example.com/cover.jpg',
      title: 'Catalog Title',
      type: WorkType.novel,
    });
  });
});
