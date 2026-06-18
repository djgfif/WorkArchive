import { BadRequestException } from '@nestjs/common';
import {
  CatalogWorkSource,
  WorkStatus,
  WorkSyncStatus,
  WorkType,
} from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildCatalogCreateData,
  buildCatalogUpdateData,
  buildUserRecordCreateData,
  buildUserRecordUpdateData,
  parseOptionalDtoDate,
} from '../src/modules/works/work-compatibility-data';

describe('work compatibility data builders', () => {
  it('parses optional DTO dates and rejects invalid values', () => {
    expect(parseOptionalDtoDate(null, 'startedAt')).toBeNull();
    expect(parseOptionalDtoDate(undefined, 'startedAt')).toBeNull();
    expect(
      parseOptionalDtoDate('2026-04-18T00:00:00.000Z', 'startedAt'),
    ).toEqual(new Date('2026-04-18T00:00:00.000Z'));
    expect(() => parseOptionalDtoDate('not-a-date', 'startedAt')).toThrow(
      BadRequestException,
    );
  });

  it('builds normalized flat catalog create data', () => {
    expect(
      buildCatalogCreateData(
        {
          title: '  Dune  ',
          author: ' Frank Herbert ',
          genres: ['판타지'],
          description: ' Summary ',
          thumbnailUrl: ' https://example.com/cover.jpg ',
        },
        ['판타지'],
      ),
    ).toEqual({
      author: 'Frank Herbert',
      description: 'Summary',
      genres: ['판타지'],
      source: CatalogWorkSource.legacy_flat,
      thumbnailUrl: 'https://example.com/cover.jpg',
      title: 'Dune',
      type: WorkType.novel,
    });
  });

  it('builds normalized user record create data with default sync metadata', () => {
    expect(
      buildUserRecordCreateData(
        'user-1',
        'work-1',
        {
          title: 'Dune',
          status: WorkStatus.completed,
          rating: 5,
          shortReview: ' Short ',
          review: ' Long ',
          favorite: true,
          startedAt: '2026-04-18T00:00:00.000Z',
        },
        ['완독'],
      ),
    ).toEqual(
      expect.objectContaining({
        catalogTitleId: 'work-1',
        catalogWorkId: 'work-1',
        favorite: true,
        personalTags: ['완독'],
        rating: 5,
        review: 'Long',
        serverVersion: 1,
        shortReview: 'Short',
        startedAt: new Date('2026-04-18T00:00:00.000Z'),
        status: WorkStatus.completed,
        syncStatus: WorkSyncStatus.synced,
        userId: 'user-1',
      }),
    );
  });

  it('builds sparse catalog and record update data only for provided fields', () => {
    expect(
      buildCatalogUpdateData(
        {
          title: '  Dune Messiah ',
          genres: ['SF'],
        },
        ['SF'],
      ),
    ).toEqual({
      genres: ['SF'],
      title: 'Dune Messiah',
    });

    expect(
      buildUserRecordUpdateData(
        {
          favorite: false,
          personalTags: ['다시 읽기'],
          rating: null,
          startedAt: null,
        },
        ['다시 읽기'],
      ),
    ).toEqual({
      favorite: false,
      personalTags: ['다시 읽기'],
      rating: null,
      startedAt: null,
    });
  });
});
