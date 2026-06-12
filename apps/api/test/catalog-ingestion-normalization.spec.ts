import { describe, expect, it } from '@jest/globals';

import {
  hasCatalogReleaseIdentity,
  normalizeCatalogExternalRef,
  normalizeCatalogReleaseCandidate,
} from '../src/modules/catalog/catalog-ingestion-normalization';

describe('catalog ingestion normalization helpers', () => {
  it('normalizes external references and rejects missing identity fields', () => {
    expect(
      normalizeCatalogExternalRef({
        externalId: '  123  ',
        provider: '  aladin  ',
        rawType: '  volume  ',
        url: '  https://example.com/item  ',
      }),
    ).toEqual({
      externalId: '123',
      provider: 'aladin',
      rawType: 'volume',
      url: 'https://example.com/item',
    });
    expect(
      normalizeCatalogExternalRef({
        externalId: '',
        provider: 'aladin',
      }),
    ).toBeNull();
    expect(
      normalizeCatalogExternalRef({
        externalId: '123',
        provider: '   ',
      }),
    ).toBeNull();
  });

  it('normalizes release candidate dates, isbn, labels, and nested refs', () => {
    expect(
      normalizeCatalogReleaseCandidate({
        displayLabel: '   ',
        externalRefs: [
          {
            externalId: ' volume-1 ',
            provider: ' aladin ',
            rawType: ' book ',
          },
          {
            externalId: '   ',
            provider: 'ignored',
          },
        ],
        isbn: '978-1-23456-789-0',
        releaseDate: '2026-04',
        releaseType: '  edition  ',
        sequence: 1,
        summary: '  summary  ',
        thumbnailUrl: '  https://example.com/cover.jpg  ',
        title: '  Dune Vol. 1  ',
      }),
    ).toEqual({
      displayLabel: 'Vol. 1',
      externalRefs: [
        {
          externalId: 'volume-1',
          provider: 'aladin',
          rawType: 'book',
          url: '',
        },
      ],
      isbn: '9781234567890',
      releaseDate: new Date('2026-04-01T00:00:00.000Z'),
      releaseType: 'edition',
      sequence: 1,
      summary: 'summary',
      thumbnailUrl: 'https://example.com/cover.jpg',
      title: 'Dune Vol. 1',
    });
  });

  it('falls back to volume defaults and drops invalid date/isbn values', () => {
    expect(
      normalizeCatalogReleaseCandidate({
        isbn: '123',
        releaseDate: 'not-a-date',
        title: '  Dune  ',
      }),
    ).toEqual({
      displayLabel: 'Dune',
      externalRefs: [],
      isbn: null,
      releaseDate: null,
      releaseType: 'volume',
      sequence: null,
      summary: '',
      thumbnailUrl: '',
      title: 'Dune',
    });
  });

  it('detects release identity by external ref, isbn, or sequence with label', () => {
    expect(
      hasCatalogReleaseIdentity({
        displayLabel: '',
        externalRefs: [
          {
            externalId: '123',
            provider: 'aladin',
            rawType: '',
            url: '',
          },
        ],
        isbn: null,
        sequence: null,
      }),
    ).toBe(true);
    expect(
      hasCatalogReleaseIdentity({
        displayLabel: '',
        externalRefs: [],
        isbn: '9781234567890',
        sequence: null,
      }),
    ).toBe(true);
    expect(
      hasCatalogReleaseIdentity({
        displayLabel: 'Vol. 1',
        externalRefs: [],
        isbn: null,
        sequence: 1,
      }),
    ).toBe(true);
    expect(
      hasCatalogReleaseIdentity({
        displayLabel: '',
        externalRefs: [],
        isbn: null,
        sequence: 1,
      }),
    ).toBe(false);
  });
});
