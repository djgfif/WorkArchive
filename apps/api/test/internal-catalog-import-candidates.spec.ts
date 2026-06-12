import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  type ImportCatalogTitleCandidate,
  toInternalCatalogImportCandidate,
} from '../src/modules/imports/internal-catalog-import-candidates';

describe('toInternalCatalogImportCandidate', () => {
  it('maps catalog titles to normalized import candidates', () => {
    const candidate = toInternalCatalogImportCandidate({
      aliases: ['듄', 'Dune'],
      canonicalTitle: 'Dune',
      contributors: [
        {
          contributor: {
            displayName: 'Frank Herbert',
          },
          role: 'author',
        },
      ],
      displayTitle: 'Dune',
      externalRefs: [
        {
          externalId: '/works/OL123W',
          provider: 'open_library',
          rawType: 'work',
          url: 'https://openlibrary.org/works/OL123W',
        },
      ],
      franchise: {
        displayName: 'Dune Universe',
      },
      id: 'catalog-dune',
      mediumType: WorkType.novel,
      originalTitle: null,
      releaseYear: 1965,
      releases: [
        {
          displayLabel: '초판',
          externalRefs: [
            {
              externalId: '9780441172719',
              provider: 'google_books',
              rawType: 'volume',
              url: 'https://books.example/dune',
            },
          ],
          isbn: '9780441172719',
          releaseDate: '1965-08-01',
          releaseType: 'volume',
          sequence: 1,
          summary: 'First edition.',
          thumbnailUrl: 'https://img.example/dune.jpg',
          title: 'Dune',
        },
      ],
      subType: null,
      summary: 'A desert saga.',
      thumbnailUrl: 'https://img.example/catalog-dune.jpg',
      verificationStatus: 'verified',
    } as unknown as ImportCatalogTitleCandidate);

    expect(candidate).toEqual(
      expect.objectContaining({
        author: 'Frank Herbert',
        catalogMatch: {
          id: 'catalog-dune',
          title: 'Dune',
          verificationStatus: 'verified',
        },
        confidence: 0.95,
        id: 'catalog:catalog-dune',
        mediumType: WorkType.novel,
        sourceId: 'catalog',
        sourceLabel: '내부 카탈로그',
        title: 'Dune',
        type: WorkType.novel,
      }),
    );
    expect(candidate.externalRefs).toEqual([
      {
        externalId: '/works/OL123W',
        provider: 'open_library',
        rawType: 'work',
        url: 'https://openlibrary.org/works/OL123W',
      },
    ]);
    expect(candidate.releaseCandidates).toEqual([
      expect.objectContaining({
        displayLabel: '초판',
        isbn: '9780441172719',
        releaseDate: '1965-08-01',
        releaseType: 'volume',
        sequence: 1,
        title: 'Dune',
      }),
    ]);
  });
});
