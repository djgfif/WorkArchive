import {
  CatalogVerificationStatus,
  type CatalogRelease,
} from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildCatalogReleaseCreateData,
  buildCatalogReleaseUpdateData,
  buildCatalogTitleUpdateData,
  toCatalogMatchView,
} from '../src/modules/catalog/catalog-ingestion-payloads';

function createCatalogRelease(
  overrides: Partial<CatalogRelease> = {},
): CatalogRelease {
  const now = new Date('2026-04-18T00:00:00.000Z');

  return {
    catalogTitleId: 'catalog-title-1',
    createdAt: now,
    displayLabel: 'Vol. 1',
    id: 'release-1',
    isbn: '9781234567890',
    releaseDate: now,
    releaseType: 'volume',
    sequence: 1,
    summary: 'Existing summary',
    thumbnailUrl: 'https://example.com/existing.jpg',
    title: 'Existing title',
    updatedAt: now,
    ...overrides,
  };
}

describe('catalog ingestion payload helpers', () => {
  it('builds sparse catalog title updates without overwriting existing metadata', () => {
    expect(
      buildCatalogTitleUpdateData(
        {
          country: null,
          franchiseId: null,
          releaseYear: null,
          subType: '',
          summary: '',
          thumbnailUrl: '',
        },
        {
          country: 'KR',
          franchiseId: 'franchise-1',
          releaseYear: 2026,
          subType: 'light_novel',
          summary: 'Summary',
          thumbnailUrl: 'https://example.com/cover.jpg',
        },
      ),
    ).toEqual({
      country: 'KR',
      franchiseId: 'franchise-1',
      releaseYear: 2026,
      subType: 'light_novel',
      summary: 'Summary',
      thumbnailUrl: 'https://example.com/cover.jpg',
    });

    expect(
      buildCatalogTitleUpdateData(
        {
          country: 'JP',
          franchiseId: 'franchise-existing',
          releaseYear: 2025,
          subType: 'manga',
          summary: 'Existing summary',
          thumbnailUrl: 'https://example.com/existing.jpg',
        },
        {
          country: 'KR',
          franchiseId: 'franchise-new',
          releaseYear: 2026,
          subType: 'light_novel',
          summary: 'New summary',
          thumbnailUrl: 'https://example.com/new.jpg',
        },
      ),
    ).toEqual({});
  });

  it('builds release create data from normalized candidates', () => {
    const releaseDate = new Date('2026-04-01T00:00:00.000Z');

    expect(
      buildCatalogReleaseCreateData({
        displayLabel: 'Vol. 2',
        isbn: '9781234567890',
        releaseDate,
        releaseType: 'volume',
        sequence: 2,
        summary: 'Summary',
        thumbnailUrl: 'https://example.com/cover.jpg',
        title: 'Title',
      }),
    ).toEqual({
      displayLabel: 'Vol. 2',
      isbn: '9781234567890',
      releaseDate,
      releaseType: 'volume',
      sequence: 2,
      summary: 'Summary',
      thumbnailUrl: 'https://example.com/cover.jpg',
      title: 'Title',
    });
  });

  it('builds release updates while preserving existing values for empty candidates', () => {
    const releaseDate = new Date('2026-05-01T00:00:00.000Z');

    expect(
      buildCatalogReleaseUpdateData(createCatalogRelease(), {
        displayLabel: '',
        isbn: null,
        releaseDate: null,
        releaseType: '',
        sequence: null,
        summary: '',
        thumbnailUrl: '',
        title: '',
      }),
    ).toMatchObject({
      displayLabel: 'Vol. 1',
      isbn: '9781234567890',
      releaseDate: new Date('2026-04-18T00:00:00.000Z'),
      releaseType: 'volume',
      sequence: 1,
      summary: 'Existing summary',
      thumbnailUrl: 'https://example.com/existing.jpg',
      title: 'Existing title',
    });

    expect(
      buildCatalogReleaseUpdateData(createCatalogRelease(), {
        displayLabel: 'Vol. 2',
        isbn: '9780987654321',
        releaseDate,
        releaseType: 'special',
        sequence: 2,
        summary: 'New summary',
        thumbnailUrl: 'https://example.com/new.jpg',
        title: 'New title',
      }),
    ).toMatchObject({
      displayLabel: 'Vol. 2',
      isbn: '9780987654321',
      releaseDate,
      releaseType: 'special',
      sequence: 2,
      summary: 'New summary',
      thumbnailUrl: 'https://example.com/new.jpg',
      title: 'New title',
    });
  });

  it('maps catalog title matches to compact import match views', () => {
    expect(
      toCatalogMatchView({
        displayTitle: 'Display Title',
        id: 'catalog-title-1',
        verificationStatus: CatalogVerificationStatus.draft,
      }),
    ).toEqual({
      id: 'catalog-title-1',
      title: 'Display Title',
      verificationStatus: CatalogVerificationStatus.draft,
    });
  });
});
