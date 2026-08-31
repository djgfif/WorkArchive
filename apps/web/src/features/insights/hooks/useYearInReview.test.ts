import { describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  computeYearInReview,
  computeYearInReviewComparison,
  getYearInReviewYears,
} from './useYearInReview';

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
    id: crypto.randomUUID(),
    importDraft: null,
    lastConsumedAt: null,
    lastConsumedLabel: null,
    personalTags: [],
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    startedAt: null,
    status: 'completed',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: 'Untitled',
    type: 'novel',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('year in review', () => {
  it('builds a monthly completion timeline for the selected year', () => {
    const review = computeYearInReview(
      [
        buildWork({
          completedAt: '2026-01-15T00:00:00.000Z',
          genres: ['SF'],
          rating: 4,
        }),
        buildWork({
          completedAt: '2026-01-20T00:00:00.000Z',
          genres: ['SF'],
          rating: 5,
        }),
        buildWork({
          completedAt: '2026-03-10T00:00:00.000Z',
          genres: ['Drama'],
          rating: 3,
        }),
      ],
      2026,
    );

    expect(review.monthlyCompletedCounts).toHaveLength(12);
    expect(review.monthlyCompletedCounts[0]).toBe(2);
    expect(review.monthlyCompletedCounts[2]).toBe(1);
    expect(review.busiestMonth).toEqual({ count: 2, month: 1 });
    expect(review.topGenre).toEqual({ count: 2, genre: 'SF' });
  });

  it('lists historical review years and compares with the nearest prior year', () => {
    const works = [
      buildWork({
        completedAt: '2026-02-01T00:00:00.000Z',
        rating: 5,
      }),
      buildWork({
        completedAt: '2026-03-01T00:00:00.000Z',
        rating: 4,
      }),
      buildWork({
        completedAt: '2024-04-01T00:00:00.000Z',
        rating: 3,
      }),
      buildWork({
        completedAt: '2025-04-01T00:00:00.000Z',
        deletedAt: '2025-05-01T00:00:00.000Z',
      }),
    ];

    const years = getYearInReviewYears(works, 2026);
    const comparison = computeYearInReviewComparison(works, 2026, years);

    expect(years).toEqual([2026, 2024]);
    expect(comparison).not.toBeNull();
    expect(comparison?.previous.year).toBe(2024);
    expect(comparison?.completedDelta).toBe(1);
    expect(comparison?.averageRatingDelta).toBeCloseTo(1.5);
  });

  it('falls back to the requested year when no completed records exist', () => {
    expect(
      getYearInReviewYears(
        [buildWork({ completedAt: null, status: 'planned' })],
        2026,
      ),
    ).toEqual([2026]);
  });
});
