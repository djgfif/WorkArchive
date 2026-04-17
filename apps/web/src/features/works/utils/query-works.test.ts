import { describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import { queryWorks } from './query-works';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'novel',
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('queryWorks', () => {
  const works = [
    buildWork({
      title: 'Bleach',
      author: 'Tite Kubo',
      type: 'manga',
      status: 'in_progress',
      rating: 4,
      updatedAt: '2026-01-05T00:00:00.000Z',
    }),
    buildWork({
      title: 'Dune',
      author: 'Frank Herbert',
      type: 'novel',
      status: 'completed',
      rating: 5,
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
    buildWork({
      title: 'Your Name',
      author: 'Makoto Shinkai',
      type: 'movie',
      status: 'planned',
      rating: 3.5,
      updatedAt: '2026-01-04T00:00:00.000Z',
    }),
  ];

  it('searches by title and author', () => {
    expect(
      queryWorks(works, {
        searchTerm: 'frank',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      }),
    ).toHaveLength(1);

    expect(
      queryWorks(works, {
        searchTerm: 'bleach',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      })[0]?.title,
    ).toBe('Bleach');
  });

  it('filters by type and status', () => {
    const filtered = queryWorks(works, {
      searchTerm: '',
      type: 'manga',
      status: 'in_progress',
      sortBy: 'updatedAt',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe('Bleach');
  });

  it('sorts by rating, title, and updatedAt', () => {
    expect(
      queryWorks(works, {
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'rating',
      }).map((work) => work.title),
    ).toEqual(['Dune', 'Bleach', 'Your Name']);

    expect(
      queryWorks(works, {
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Bleach', 'Dune', 'Your Name']);

    expect(
      queryWorks(works, {
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      }).map((work) => work.title),
    ).toEqual(['Bleach', 'Your Name', 'Dune']);
  });
});
