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
    genres: ['판타지'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'completed',
    rating: 4.5,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('work-form graph fields', () => {
  it('stores series and contributor fields as graph input separate from personal tags', () => {
    const values = createDefaultWorkFormValues();

    const parsed = parseWorkFormValues({
      ...values,
      title: 'Fate/stay night',
      type: 'anime',
      genresText: '판타지',
      personalTagsText: 'rewatch, favorite route',
      seriesText: 'Fate',
      universeText: 'TYPE-MOON',
      creatorText: 'Nasu Kinoko',
      studioText: 'ufotable',
      publisherText: 'Kadokawa',
      platformText: 'Netflix',
    });

    expect(parsed.personalTags).toEqual(['rewatch', 'favorite route']);
    expect(parsed.genres).toEqual(['판타지']);
    expect(parsed.graph).toEqual({
      series: [
        { kind: 'series', role: 'main', title: 'Fate' },
        { kind: 'universe', role: 'main', title: 'TYPE-MOON' },
      ],
      contributors: [
        {
          displayOrder: 0,
          entityType: 'person',
          name: 'Nasu Kinoko',
          role: 'original_creator',
        },
        {
          displayOrder: 0,
          entityType: 'organization',
          name: 'ufotable',
          role: 'studio',
        },
        {
          displayOrder: 0,
          entityType: 'organization',
          name: 'Kadokawa',
          role: 'publisher',
        },
        {
          displayOrder: 0,
          entityType: 'organization',
          name: 'Netflix',
          role: 'platform',
        },
      ],
    });
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

    expect(parsed.personalTags).toEqual(['rewatch']);
    expect(parsed.graph).toEqual({
      series: [{ kind: 'series', role: 'main', title: 'Fate' }],
      contributors: [
        {
          displayOrder: 0,
          entityType: 'organization',
          name: 'ufotable',
          role: 'studio',
        },
      ],
    });
  });

  it('moves legacy non-standard genres into personal tags when restoring records', () => {
    const values = createWorkFormValuesFromRecord(
      buildWork({
        genres: ['다크판타지', '판타지'],
        personalTags: ['rewatch', '다크판타지'],
      }),
    );

    expect(values.genresText).toBe('판타지');
    expect(values.personalTagsText).toBe('rewatch, 다크판타지');
  });

  it('stores only fixed genres from parsed form values', () => {
    const parsed = parseWorkFormValues({
      ...createDefaultWorkFormValues(),
      title: 'Fate/stay night',
      genresText: ' 판타지, 판타지, 다크판타지, SF ',
    });

    expect(parsed.genres).toEqual(['판타지', 'SF']);
  });
});
