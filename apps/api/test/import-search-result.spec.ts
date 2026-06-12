import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import {
  buildImportSearchResponse,
  mergeAndRankImportSearchCandidates,
  mergeImportSearchCandidates,
} from '../src/modules/imports/import-search-result';
import {
  MANUAL_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../src/modules/imports/imports.constants';

function candidate(
  overrides: Partial<ImportCandidateResponseDto> = {},
): ImportCandidateResponseDto {
  return {
    author: 'Frank Herbert',
    catalogMatch: null,
    confidence: 0.5,
    confidenceLabel: '',
    contributors: [{ name: 'Frank Herbert', role: 'author' }],
    countLabel: '',
    description: '',
    existingRecord: null,
    externalId: overrides.id ?? 'candidate-base',
    externalRefs: [],
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: overrides.id ?? 'candidate-base',
    mediumType: WorkType.novel,
    note: '',
    reason: '',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: 1965,
    scoreBreakdown: [],
    sourceCoverage: {
      externalIdentityCount: 0,
      providerCount: 0,
      providers: [],
      releaseCandidateCount: 0,
    },
    sourceId: MANUAL_PROVIDER,
    sourceLabel: 'Manual',
    sourceUrl: '',
    subType: null,
    thumbnailUrl: '',
    title: 'Dune',
    titleAliases: [],
    type: WorkType.novel,
    ...overrides,
  };
}

describe('import search result helpers', () => {
  it('merges duplicate provider candidates before decoration', () => {
    const merged = mergeImportSearchCandidates([
      candidate({
        id: 'manual-dune',
        sourceId: MANUAL_PROVIDER,
        sourceLabel: 'Manual',
      }),
      candidate({
        id: 'open-library-dune',
        sourceId: OPEN_LIBRARY_PROVIDER,
        sourceLabel: 'Open Library',
        titleAliases: ['듄'],
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.titleAliases).toContain('듄');
  });

  it('merges, ranks, and limits decorated candidates', () => {
    const ranked = mergeAndRankImportSearchCandidates({
      candidates: [
        candidate({
          confidence: 0.3,
          id: 'partial',
          title: 'Dune Messiah',
        }),
        candidate({
          confidence: 0.9,
          id: 'exact',
          title: 'Dune',
        }),
      ],
      limit: 1,
      mediumType: WorkType.novel,
      query: 'Dune',
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.id).toBe('exact');
  });

  it('builds the import search response shape', () => {
    const candidates = [candidate()];
    const diagnostics = {
      providers: [],
    };

    expect(
      buildImportSearchResponse({
        candidates,
        diagnostics,
        provider: OPEN_LIBRARY_PROVIDER,
        providers: [OPEN_LIBRARY_PROVIDER, MANUAL_PROVIDER],
        query: 'Dune',
      }),
    ).toEqual({
      candidates,
      diagnostics,
      provider: OPEN_LIBRARY_PROVIDER,
      providers: [OPEN_LIBRARY_PROVIDER, MANUAL_PROVIDER],
      query: 'Dune',
    });
  });
});
