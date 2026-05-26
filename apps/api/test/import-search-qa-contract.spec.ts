import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import { mergeImportCandidates } from '../src/modules/imports/candidates/import-candidate-merge';
import { rankImportCandidates } from '../src/modules/imports/candidates/import-candidate-ranking';

function createCandidate(
  overrides: Partial<ImportCandidateResponseDto> = {},
): ImportCandidateResponseDto {
  const provider = overrides.sourceId ?? 'manual';
  const externalRefs = overrides.externalRefs ?? [];

  return {
    author: '',
    catalogMatch: null,
    confidence: 0.5,
    confidenceLabel: '후보',
    contributors: [],
    countLabel: '',
    description: '',
    existingRecord: null,
    externalId: overrides.id ?? 'candidate',
    externalRefs,
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: overrides.id ?? 'candidate',
    mediumType: WorkType.novel,
    note: '',
    reason: '',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: null,
    scoreBreakdown: [],
    sourceCoverage: {
      externalIdentityCount: externalRefs.length,
      providerCount: provider === 'manual' ? 0 : 1,
      providers: provider === 'manual' ? [] : [provider],
      releaseCandidateCount: 0,
    },
    sourceId: provider,
    sourceLabel: provider,
    sourceUrl: '',
    subType: null,
    thumbnailUrl: '',
    title: 'Gate 1 QA Candidate',
    titleAliases: [],
    type: WorkType.novel,
    ...overrides,
  };
}

describe('Gate 1 import/search QA contracts', () => {
  it('ranks exact and alias title matches above weak token matches', () => {
    const ranked = rankImportCandidates({
      query: 'Solo Leveling',
      mediumType: WorkType.web_novel,
      candidates: [
        createCandidate({
          id: 'weak-token',
          mediumType: WorkType.web_novel,
          sourceId: 'manual',
          title: 'Solo Leveling Side Story Special Edition',
          type: WorkType.web_novel,
        }),
        createCandidate({
          id: 'alias-match',
          externalRefs: [
            {
              externalId: 'kakao-1',
              provider: 'kakao_book',
              rawType: 'web_novel',
              url: 'https://example.test/kakao-1',
            },
          ],
          mediumType: WorkType.web_novel,
          sourceId: 'kakao_book',
          title: '나 혼자만 레벨업',
          titleAliases: ['Solo Leveling', 'Only I Level Up'],
          type: WorkType.web_novel,
        }),
      ],
    });

    expect(ranked[0]?.id).toBe('alias-match');
    expect(ranked[0]?.sourceCoverage.providers).toContain('kakao_book');
  });

  it('guards wrong-medium candidates for ambiguous titles', () => {
    const ranked = rankImportCandidates({
      query: 'Dune 2021',
      mediumType: WorkType.movie,
      candidates: [
        createCandidate({
          id: 'dune-novel',
          author: 'Frank Herbert',
          contributors: [{ name: 'Frank Herbert', role: 'author' }],
          mediumType: WorkType.novel,
          releaseYear: 1965,
          title: 'Dune',
          type: WorkType.novel,
        }),
        createCandidate({
          id: 'dune-movie',
          author: 'Denis Villeneuve',
          contributors: [{ name: 'Denis Villeneuve', role: 'director' }],
          externalRefs: [
            {
              externalId: '438631',
              provider: 'tmdb',
              rawType: 'movie',
              url: 'https://example.test/tmdb-438631',
            },
          ],
          mediumType: WorkType.movie,
          releaseYear: 2021,
          sourceId: 'tmdb',
          title: 'Dune',
          type: WorkType.movie,
        }),
      ],
    });

    expect(ranked[0]?.id).toBe('dune-movie');
  });

  it('keeps manual fallback available without merging it into external identity matches', () => {
    const merged = mergeImportCandidates([
      createCandidate({
        id: 'external',
        externalRefs: [
          {
            externalId: 'Q123',
            provider: 'wikidata',
            rawType: 'entity',
            url: 'https://example.test/Q123',
          },
        ],
        sourceId: 'wikidata',
        title: 'Gate 1 QA Candidate',
      }),
      createCandidate({
        id: 'manual-fallback',
        sourceId: 'manual',
        title: 'Gate 1 QA Candidate',
      }),
    ]);

    expect(merged.map((candidate) => candidate.id)).toEqual([
      'external',
      'manual-fallback',
    ]);
  });

  it('deduplicates provider candidates by catalog match before weaker title fallback', () => {
    const catalogMatch = {
      id: 'catalog-title-1',
      title: 'Sousou no Frieren',
      verificationStatus: 'unverified',
    };
    const merged = mergeImportCandidates([
      createCandidate({
        id: 'anilist',
        catalogMatch,
        externalRefs: [
          {
            externalId: '154587',
            provider: 'anilist',
            rawType: 'anime',
            url: 'https://example.test/anilist',
          },
        ],
        mediumType: WorkType.anime,
        sourceId: 'anilist',
        title: 'Sousou no Frieren',
        type: WorkType.anime,
      }),
      createCandidate({
        id: 'wikidata',
        catalogMatch,
        externalRefs: [
          {
            externalId: 'Q112010603',
            provider: 'wikidata',
            rawType: 'entity',
            url: 'https://example.test/wikidata',
          },
        ],
        mediumType: WorkType.anime,
        sourceId: 'wikidata',
        title: '葬送のフリーレン',
        titleAliases: ['Sousou no Frieren', '장송의 프리렌'],
        type: WorkType.anime,
      }),
      createCandidate({
        id: 'title-only-fallback',
        mediumType: WorkType.anime,
        sourceId: 'manual',
        title: 'Sousou no Frieren',
        type: WorkType.anime,
      }),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        catalogMatch,
        sourceCoverage: expect.objectContaining({
          providerCount: 2,
          providers: expect.arrayContaining(['anilist', 'wikidata']),
        }),
      }),
    );
    expect(merged[1]?.id).toBe('title-only-fallback');
  });
});
