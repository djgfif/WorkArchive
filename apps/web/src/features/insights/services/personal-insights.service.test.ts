import { describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import { calculatePersonalInsights } from './personal-insights.service';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: '',
    catalogTitleId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    favorite: false,
    genres: [],
    personalTags: [],
    id: crypto.randomUUID(),
    importDraft: null,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    lastConsumedLabel: null,
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
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
  it('summarizes active local records without deleted records', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          completedAt: '2026-01-15T00:00:00.000Z',
          favorite: true,
          genres: ['SF', '정치극'],
          personalTags: ['인생작 후보', '다시 볼 것'],
          rating: 5,
          status: 'completed',
          title: 'Dune',
          type: 'novel',
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
        buildWork({
          genres: ['판타지'],
          personalTags: ['다시 볼 것'],
          rating: 4,
          status: 'in_progress',
          title: 'Frieren',
          type: 'manga',
          updatedAt: '2026-03-01T00:00:00.000Z',
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

    expect(insights.activeCount).toBe(2);
    expect(insights.averageRating).toBe(4.5);
    expect(insights.completedThisYearCount).toBe(1);
    expect(insights.favoriteCount).toBe(1);
    expect(insights.droppedRate).toBe(0);
    expect(insights.typeCounts.novel).toBe(1);
    expect(insights.typeCounts.manga).toBe(1);
    expect(insights.statusCounts.completed).toBe(1);
    expect(insights.statusCounts.in_progress).toBe(1);
    expect(insights.ratingDistribution).toEqual([
      { count: 1, rating: 5 },
      { count: 1, rating: 4 },
    ]);
    expect(insights.tagCounts).toEqual([
      { count: 2, tag: '다시 볼 것' },
      { count: 1, tag: '인생작 후보' },
    ]);
    expect(insights.genreCounts).toEqual([
      { count: 1, genre: 'SF' },
      { count: 1, genre: '정치극' },
      { count: 1, genre: '판타지' },
    ]);
    expect(insights.monthlyCompletedCounts.find(({ month }) => month === 1)).toEqual({
      count: 1,
      month: 1,
    });
    expect(insights.staleWorks.map((work) => work.title)).toEqual(['Frieren']);
    expect(insights.topRatedThisYearWorks.map((work) => work.title)).toEqual([
      'Dune',
      'Frieren',
    ]);
    expect(insights.topRatedWorks.map((work) => work.title)).toEqual([
      'Dune',
      'Frieren',
    ]);
  });

  it('uses completedAt before updatedAt for yearly completion counts', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          completedAt: '2025-12-31T00:00:00.000Z',
          status: 'completed',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }),
        buildWork({
          completedAt: '2026-01-03T00:00:00.000Z',
          status: 'completed',
          updatedAt: '2025-12-30T00:00:00.000Z',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.completedThisYearCount).toBe(1);
  });

  it('calculates dropped rate and stale work order from local activity dates', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          lastConsumedAt: '2026-02-01T00:00:00.000Z',
          status: 'dropped',
          title: 'Old dropped',
          updatedAt: '2026-04-20T00:00:00.000Z',
        }),
        buildWork({
          lastConsumedAt: '2026-03-10T00:00:00.000Z',
          status: 'in_progress',
          title: 'Old progress',
          updatedAt: '2026-04-20T00:00:00.000Z',
        }),
        buildWork({
          lastConsumedAt: '2026-04-20T00:00:00.000Z',
          status: 'in_progress',
          title: 'Recent progress',
        }),
        buildWork({
          status: 'dropped',
          title: 'Dropped',
        }),
      ],
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(insights.droppedRate).toBe(0.5);
    expect(insights.staleWorks.map((work) => work.title)).toEqual([
      'Old progress',
    ]);
  });

});
