import { describe, expect, it } from 'vitest';

import {
  createValuesFromCandidate,
  getProviderGroupProviders,
  providerGroupOptions,
} from './quick-add-helpers';
import { createDefaultWorkFormValues } from '../utils/work-form';

describe('quick-add provider groups', () => {
  it('exposes a web serialization provider group with web search providers first', () => {
    expect(providerGroupOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '웹연재',
          value: 'web_serial',
        }),
      ]),
    );
    expect(getProviderGroupProviders('web_serial')).toEqual([
      'brave_search',
      'naver_web',
      'kakao_web',
      'tavily_search',
      'kakao_book',
      'naver_book',
      'google_books',
      'wikidata',
    ]);
  });

  it('moves unknown candidate genre text into personal tag text', () => {
    const values = createValuesFromCandidate(
      {
        author: '작가',
        catalogMatch: null,
        confidence: 1,
        confidenceLabel: '높음',
        contributors: [],
        countLabel: '',
        description: '',
        existingRecord: null,
        externalId: 'candidate-1',
        externalRefs: [],
        formatLabel: '',
        franchiseName: null,
        genresText: '회귀, 판타지, 빙의, 판타지',
        id: 'candidate-1',
        mediumType: 'web_novel',
        note: '',
        reason: '',
        relationsHint: [],
        releaseCandidates: [],
        releaseYear: null,
        scoreBreakdown: [],
        sourceId: 'manual',
        sourceLabel: '직접 추가',
        sourceUrl: '',
        subType: null,
        thumbnailUrl: '',
        title: '후보 작품',
        type: 'web_novel',
      },
      createDefaultWorkFormValues,
    );

    expect(values.genresText).toBe('판타지');
    expect(values.personalTagsText).toBe('회귀, 빙의');
  });
});
