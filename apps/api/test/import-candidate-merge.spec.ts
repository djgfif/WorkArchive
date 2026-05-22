import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import { mergeImportCandidates } from '../src/modules/imports/candidates/import-candidate-merge';

function createCandidate(
  overrides: Partial<ImportCandidateResponseDto> = {},
): ImportCandidateResponseDto {
  return {
    author: '싱숑',
    catalogMatch: null,
    confidence: 0.75,
    confidenceLabel: '후보',
    contributors: [{ name: '싱숑', role: 'author' }],
    countLabel: '',
    description: '',
    existingRecord: null,
    externalId: overrides.id ?? 'candidate-base',
    externalRefs: [],
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: overrides.id ?? 'candidate-base',
    mediumType: WorkType.web_novel,
    note: '',
    reason: '',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: 2018,
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
    thumbnailUrl: '',
    title: '전지적 독자 시점',
    titleAliases: [],
    type: WorkType.web_novel,
    ...overrides,
  };
}

describe('mergeImportCandidates', () => {
  it.each([
    ['subType', { subType: '외전' }],
    ['formatLabel', { formatLabel: '스핀오프' }],
    ['countLabel', { countLabel: '특별판' }],
    ['titleAliases', { titleAliases: ['전지적 독자 시점 한정판'] }],
  ] satisfies Array<[string, Partial<ImportCandidateResponseDto>]>)(
    'does not weak-merge Korean variant signals from %s',
    (_fieldName, variantOverrides) => {
      const merged = mergeImportCandidates([
        createCandidate({ id: 'base' }),
        createCandidate({ id: 'variant', ...variantOverrides }),
      ]);

      expect(merged).toHaveLength(2);
      expect(merged.map((candidate) => candidate.id)).toEqual([
        'base',
        'variant',
      ]);
    },
  );
});
