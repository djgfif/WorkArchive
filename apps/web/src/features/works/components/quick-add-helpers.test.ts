import { describe, expect, it } from 'vitest';

import type { ImportCandidate } from '@features/imports';
import {
  createValuesFromCandidate,
  getCandidateContributorText,
  getProviderGroupProviders,
  providerGroupOptions,
} from './quick-add-helpers';
import { createDefaultWorkFormValues } from '../utils/work-form';

function buildCandidate(
  overrides: Partial<ImportCandidate> = {},
): ImportCandidate {
  return {
    author: 'Frank Herbert',
    catalogMatch: null,
    confidence: 1,
    confidenceLabel: '높음',
    contributors: [{ name: 'Frank Herbert', role: 'author' }],
    countLabel: '',
    description: '',
    existingRecord: null,
    externalId: 'candidate-1',
    externalRefs: [],
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: 'candidate-1',
    mediumType: 'novel',
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
    titleAliases: [],
    type: 'novel',
    ...overrides,
  };
}

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
      buildCandidate({
        author: '작가',
        genresText: '회귀, 판타지, 빙의, 판타지',
        mediumType: 'web_novel',
        title: '후보 작품',
        type: 'web_novel',
      }),
      createDefaultWorkFormValues,
    );

    expect(values.genresText).toBe('판타지');
    expect(values.personalTagsText).toBe('회귀, 빙의');
  });

  it('puts screen work directors and production companies before original authors', () => {
    const candidate = buildCandidate({
      author: '프랭크 허버트',
      contributors: [
        { name: '프랭크 허버트', role: 'author' },
        { name: '드니 빌뇌브', role: 'director' },
        { name: 'Legendary Pictures', role: 'production company' },
      ],
      mediumType: 'movie',
      title: '듄',
      type: 'movie',
    });
    const values = createValuesFromCandidate(
      candidate,
      createDefaultWorkFormValues,
    );

    expect(values.creatorText).toBe(
      '드니 빌뇌브, Legendary Pictures, 프랭크 허버트',
    );
    expect(getCandidateContributorText(candidate)).toBe(
      '드니 빌뇌브 · director, Legendary Pictures · production company, 프랭크 허버트 · author',
    );
  });
});
