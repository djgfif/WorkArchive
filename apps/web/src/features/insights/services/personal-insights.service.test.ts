import { describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import { calculatePersonalInsights } from './personal-insights.service';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: '',
    catalogTitleId: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    droppedAt: null,
    favorite: false,
    genres: [],
    personalTags: [],
    id: crypto.randomUUID(),
    importDraft: null,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    lastConsumedAt: null,
    lastConsumedLabel: null,
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    startedAt: null,
    status: 'planned',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: 'Untitled',
    type: 'novel',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculatePersonalInsights', () => {
  it('aggregates media, status, rating, and private review coverage', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          favorite: true,
          rating: 5,
          review: 'long note',
          status: 'completed',
          title: 'Dune',
          type: 'novel',
        }),
        buildWork({
          rating: 4,
          shortReview: 'good',
          status: 'in_progress',
          title: 'Frieren',
          type: 'manga',
        }),
        buildWork({
          rating: 4,
          status: 'dropped',
          title: 'Dropped',
          type: 'anime',
        }),
        buildWork({
          deletedAt: '2026-03-02T00:00:00.000Z',
          rating: 1,
          status: 'completed',
          title: 'Deleted',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.totalWorks).toBe(3);
    expect(insights.averageRating).toBeCloseTo(4.333, 3);
    expect(insights.favoriteCount).toBe(1);
    expect(insights.reviewEmptyCount).toBe(1);
    expect(insights.typeCounts.novel).toBe(1);
    expect(insights.typeCounts.manga).toBe(1);
    expect(insights.typeCounts.anime).toBe(1);
    expect(insights.statusCounts.completed).toBe(1);
    expect(insights.statusCounts.in_progress).toBe(1);
    expect(insights.statusCounts.dropped).toBe(1);
    expect(insights.droppedCount).toBe(1);
    expect(insights.plannedCount).toBe(0);
    expect(insights.onHoldCount).toBe(0);
    expect(insights.ratingDistribution).toEqual([
      { count: 1, rating: 5 },
      { count: 2, rating: 4 },
    ]);
  });

  it('aggregates top personalTags and genres without legacy graph tags', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          genres: ['SF', '드라마'],
          personalTags: ['다시 볼 것', 'series:Dune'],
        }),
        buildWork({
          genres: ['SF'],
          personalTags: ['다시 볼 것', '정치극'],
        }),
        buildWork({
          genres: ['판타지'],
          personalTags: ['정치극'],
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.tagCounts).toEqual([
      { count: 2, tag: '다시 볼 것' },
      { count: 2, tag: '정치극' },
    ]);
    expect(insights.genreCounts).toEqual([
      { count: 2, genre: 'SF' },
      { count: 1, genre: '드라마' },
      { count: 1, genre: '판타지' },
    ]);
  });

  it('aggregates recent additions, recent updates, and completed-this-year records', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          completedAt: '2026-01-15T00:00:00.000Z',
          createdAt: '2026-04-20T00:00:00.000Z',
          status: 'completed',
          title: 'Recent completed',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }),
        buildWork({
          completedAt: '2025-12-31T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          status: 'completed',
          title: 'Old completed',
          updatedAt: '2026-04-23T00:00:00.000Z',
        }),
        buildWork({
          createdAt: '2026-04-10T00:00:00.000Z',
          status: 'planned',
          title: 'Recent planned',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.completedThisYearCount).toBe(1);
    expect(insights.addedRecentlyCount).toBe(2);
    expect(insights.updatedRecentlyCount).toBe(2);
    expect(insights.recentlyAddedWorks.map((work) => work.title)).toEqual([
      'Recent completed',
      'Recent planned',
    ]);
    expect(insights.recentlyUpdatedWorks.map((work) => work.title)).toEqual([
      'Old completed',
      'Recent completed',
    ]);
  });
});
