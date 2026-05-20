import { describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createDefaultWorkFormValues,
  createWorkFormValuesFromRecord,
  parseWorkFormValues,
} from './work-form';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'anime',
    title: 'Fate/stay night',
    author: 'TYPE-MOON',
    genres: ['Fantasy'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'completed',
    rating: 4.5,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('work-form graph tags', () => {
  it('stores series and contributor fields as prefixed personal tags', () => {
    const values = createDefaultWorkFormValues();

    const parsed = parseWorkFormValues({
      ...values,
      title: 'Fate/stay night',
      type: 'anime',
      genresText: 'Fantasy',
      personalTagsText: 'rewatch, favorite route',
      seriesText: 'Fate',
      universeText: 'TYPE-MOON',
      creatorText: 'Nasu Kinoko',
      studioText: 'ufotable',
      publisherText: 'Kadokawa',
      platformText: 'Netflix',
    });

    expect(parsed.personalTags).toEqual([
      'rewatch',
      'favorite route',
      'series:Fate',
      'universe:TYPE-MOON',
      'creator:Nasu Kinoko',
      'studio:ufotable',
      'publisher:Kadokawa',
      'platform:Netflix',
    ]);
  });

  it('restores prefixed tags into graph fields without leaking them into personal tags', () => {
    const values = createWorkFormValuesFromRecord(
      buildWork({
        personalTags: [
          'series:Fate',
          'universe:TYPE-MOON',
          'creator:Nasu Kinoko',
          'studio:ufotable',
          'publisher:Kadokawa',
          'platform:Netflix',
          'rewatch',
        ],
      }),
    );

    expect(values.seriesText).toBe('Fate');
    expect(values.universeText).toBe('TYPE-MOON');
    expect(values.creatorText).toBe('Nasu Kinoko');
    expect(values.studioText).toBe('ufotable');
    expect(values.publisherText).toBe('Kadokawa');
    expect(values.platformText).toBe('Netflix');
    expect(values.personalTagsText).toBe('rewatch');
  });

  it('replaces edited graph tags while preserving existing personal tags', () => {
    const values = createWorkFormValuesFromRecord(
      buildWork({
        personalTags: ['series:Fate', 'studio:Studio Deen', 'rewatch'],
      }),
    );

    const parsed = parseWorkFormValues({
      ...values,
      studioText: 'ufotable',
    });

    expect(parsed.personalTags).toEqual(['rewatch', 'series:Fate', 'studio:ufotable']);
  });
});
