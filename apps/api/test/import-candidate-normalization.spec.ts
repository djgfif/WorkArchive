import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  normalizeImportCandidate,
  stripHtml,
} from '../src/modules/imports/candidates/import-candidate-normalization';

describe('import candidate normalization', () => {
  it('strips HTML tags in linear passes without dropping unmatched text', () => {
    expect(stripHtml('<p>전지적</p><strong>독자</strong> 시점')).toBe(
      '전지적독자 시점',
    );
    expect(stripHtml('제목 < 미완성 태그')).toBe('제목 < 미완성 태그');
  });

  it('normalizes thumbnail URLs with URL parsing instead of substring slicing', () => {
    const candidate = normalizeImportCandidate({
      author: '',
      catalogMatch: null,
      confidence: 0.5,
      confidenceLabel: '후보',
      contributors: [],
      countLabel: '',
      description: '',
      existingRecord: null,
      externalId: 'thumb-test',
      externalRefs: [],
      formatLabel: '',
      franchiseName: null,
      genresText: '',
      id: 'thumb-test',
      mediumType: WorkType.novel,
      note: '',
      reason: '',
      relationsHint: [],
      releaseCandidates: [],
      releaseYear: null,
      scoreBreakdown: [],
      sourceCoverage: {
        externalIdentityCount: 0,
        providerCount: 0,
        providers: [],
        releaseCandidateCount: 0,
      },
      sourceId: 'manual',
      sourceLabel: 'Manual',
      sourceUrl: '',
      subType: null,
      thumbnailUrl: 'http://covers.openlibrary.org/b/id/1-L.jpg',
      title: '테스트',
      titleAliases: [],
      type: WorkType.novel,
    });

    expect(candidate.thumbnailUrl).toBe(
      'https://covers.openlibrary.org/b/id/1-L.jpg',
    );
  });
});
