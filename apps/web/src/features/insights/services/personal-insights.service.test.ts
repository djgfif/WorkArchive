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
    tier: null,
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
          favorite: true,
          rating: 5,
          status: 'completed',
          title: 'Dune',
          type: 'novel',
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
        buildWork({
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
    expect(insights.typeCounts.novel).toBe(1);
    expect(insights.typeCounts.manga).toBe(1);
    expect(insights.statusCounts.completed).toBe(1);
    expect(insights.statusCounts.in_progress).toBe(1);
    expect(insights.ratingDistribution).toEqual([
      { count: 1, rating: 5 },
      { count: 1, rating: 4 },
    ]);
    expect(insights.topRatedWorks.map((work) => work.title)).toEqual([
      'Dune',
      'Frieren',
    ]);
  });
});
