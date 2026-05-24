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
  it('preserves external refs, release refs, aliases, and provider coverage when providers merge', () => {
    const merged = mergeImportCandidates([
      createCandidate({
        id: 'anilist-frieren',
        externalRefs: [
          {
            externalId: '154587',
            provider: 'anilist',
            rawType: 'anime',
            url: 'https://anilist.co/anime/154587',
          },
        ],
        mediumType: WorkType.anime,
        releaseCandidates: [
          {
            externalRefs: [
              {
                externalId: '154587-tv',
                provider: 'anilist',
                rawType: 'season',
                url: 'https://anilist.co/anime/154587',
              },
            ],
            releaseDate: '2023',
            releaseType: 'tv',
            title: 'Sousou no Frieren',
          },
        ],
        releaseYear: 2023,
        sourceId: 'anilist',
        sourceLabel: 'AniList',
        title: 'Sousou no Frieren',
        titleAliases: ['葬送のフリーレン'],
        type: WorkType.anime,
      }),
      createCandidate({
        id: 'wikidata-frieren',
        externalRefs: [
          {
            externalId: 'Q112010603',
            provider: 'wikidata',
            rawType: 'entity',
            url: 'https://www.wikidata.org/wiki/Q112010603',
          },
        ],
        mediumType: WorkType.anime,
        releaseYear: 2023,
        sourceId: 'wikidata',
        sourceLabel: 'Wikidata',
        title: '葬送のフリーレン',
        titleAliases: ['Sousou no Frieren', '장송의 프리렌'],
        type: WorkType.anime,
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        externalRefs: expect.arrayContaining([
          expect.objectContaining({ provider: 'anilist' }),
          expect.objectContaining({ provider: 'wikidata' }),
        ]),
        sourceCoverage: expect.objectContaining({
          providerCount: 2,
          providers: expect.arrayContaining(['anilist', 'wikidata']),
          releaseCandidateCount: 1,
        }),
        titleAliases: expect.arrayContaining([
          '葬送のフリーレン',
          'Sousou no Frieren',
          '장송의 프리렌',
        ]),
      }),
    );
    expect(merged[0]?.sourceCoverage.externalIdentityCount).toBe(3);
  });

  it('does not weak-merge same-title candidates with different media types', () => {
    const merged = mergeImportCandidates([
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
        mediumType: WorkType.movie,
        releaseYear: 2021,
        title: 'Dune',
        type: WorkType.movie,
      }),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((candidate) => candidate.mediumType)).toEqual([
      WorkType.novel,
      WorkType.movie,
    ]);
  });

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
