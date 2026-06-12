import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildLegacyCatalogTitleUpsertData,
  normalizeCatalogWorkGenres,
} from '../src/modules/catalog/catalog-legacy-work';

describe('catalog legacy work helpers', () => {
  it('normalizes string genres and drops invalid genre values', () => {
    expect(
      normalizeCatalogWorkGenres({
        genres: [' SF ', 'sf', '', 123, 'Fantasy'],
        title: 'Dune',
      }),
    ).toEqual({
      genres: ['SF'],
      title: 'Dune',
    });
  });

  it('leaves non-array genre payloads untouched', () => {
    const payload = {
      genres: 'SF',
      title: 'Dune',
    };

    expect(normalizeCatalogWorkGenres(payload)).toBe(payload);
  });

  it('builds legacy title upsert data from compatibility catalog work input', () => {
    const createdAt = new Date('2026-04-18T00:00:00.000Z');
    const updatedAt = new Date('2026-04-19T00:00:00.000Z');

    expect(
      buildLegacyCatalogTitleUpsertData({
        createdAt,
        description: '  summary  ',
        id: 'work-1',
        thumbnailUrl: '  https://example.com/cover.jpg  ',
        title: '  Dune  ',
        type: WorkType.novel,
        updatedAt,
      }),
    ).toEqual({
      create: {
        canonicalTitle: 'Dune',
        createdAt,
        displayTitle: 'Dune',
        id: 'work-1',
        mediumType: WorkType.novel,
        summary: 'summary',
        thumbnailUrl: 'https://example.com/cover.jpg',
        updatedAt,
      },
      update: {
        canonicalTitle: 'Dune',
        displayTitle: 'Dune',
        mediumType: WorkType.novel,
        summary: 'summary',
        thumbnailUrl: 'https://example.com/cover.jpg',
      },
    });
  });

  it('returns null for blank legacy titles', () => {
    expect(
      buildLegacyCatalogTitleUpsertData({
        id: 'work-1',
        title: '   ',
      }),
    ).toBeNull();
  });
});
