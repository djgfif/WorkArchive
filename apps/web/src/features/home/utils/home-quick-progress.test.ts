import { describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import { getHomeQuickProgressAction } from './home-quick-progress';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: '',
    createdAt: '2026-08-02T00:00:00.000Z',
    deletedAt: null,
    description: '',
    favorite: false,
    genres: [],
    id: 'work-1',
    personalTags: [],
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    status: 'in_progress',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: 'Continue Work',
    type: 'anime',
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('getHomeQuickProgressAction', () => {
  it('starts an in-progress work at the first type-aware unit', () => {
    expect(getHomeQuickProgressAction(buildWork())).toEqual({
      nextCurrent: 1,
      progressTotal: null,
      progressUnit: 'episode',
    });
  });

  it('advances the current value while preserving its total and valid unit', () => {
    expect(
      getHomeQuickProgressAction(
        buildWork({
          progressCurrent: 12,
          progressTotal: 20,
          progressUnit: 'chapter',
          type: 'webtoon',
        }),
      ),
    ).toEqual({
      nextCurrent: 13,
      progressTotal: 20,
      progressUnit: 'chapter',
    });
  });

  it.each([
    ['non-progress status', { status: 'completed' as const }],
    ['unsupported media type', { type: 'movie' as const }],
    ['completed numeric progress', { progressCurrent: 12, progressTotal: 12 }],
    [
      'invalid explicit unit',
      { progressCurrent: 2, progressUnit: 'chapter' as const },
    ],
    ['negative progress', { progressCurrent: -1 }],
    ['fractional progress', { progressCurrent: 1.5 }],
  ])('hides the action for %s', (_label, overrides) => {
    expect(getHomeQuickProgressAction(buildWork(overrides))).toBeNull();
  });
});
