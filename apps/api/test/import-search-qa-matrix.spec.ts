import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import { mergeImportCandidates } from '../src/modules/imports/candidates/import-candidate-merge';
import { rankImportCandidates } from '../src/modules/imports/candidates/import-candidate-ranking';
import {
  IMPORT_PROVIDER_VALUES,
  MANUAL_PROVIDER,
} from '../src/modules/imports/imports.constants';

interface MatrixCandidateFixture {
  author?: string;
  catalogMatch?: ImportCandidateResponseDto['catalogMatch'];
  contributors?: ImportCandidateResponseDto['contributors'];
  existingRecord?: ImportCandidateResponseDto['existingRecord'];
  externalRefs?: ImportCandidateResponseDto['externalRefs'];
  id: string;
  mediumType?: string;
  releaseYear?: number | null;
  sourceId: string;
  title: string;
  titleAliases?: string[];
}

interface MatrixCaseFixture {
  dimension: string;
  expectedAssertion: string;
  expectedCandidate?: MatrixCandidateFixture;
  expectedMergedProviders?: string[];
  expectedTopId: string;
  id: string;
  mediumType: string;
  otherCandidates?: MatrixCandidateFixture[];
  query: string;
  tags: string[];
}

interface ImportSearchQaMatrix {
  cases: MatrixCaseFixture[];
  requiredCoverageTags: string[];
  requiredMediaTypes: string[];
  requiredProviders: string[];
  version: number;
}

const matrix = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../docs/qa/IMPORT_SEARCH_QA_CASES.json'),
    'utf8',
  ),
) as ImportSearchQaMatrix;

function toWorkType(value: string): WorkType {
  if (!Object.values(WorkType).includes(value as WorkType)) {
    throw new Error(`Unknown WorkType in import/search QA matrix: ${value}`);
  }

  return value as WorkType;
}

function buildCandidates(testCase: MatrixCaseFixture) {
  return [
    ...(testCase.expectedCandidate
      ? [createCandidate(testCase, testCase.expectedCandidate)]
      : []),
    ...(testCase.otherCandidates ?? []).map((candidate) =>
      createCandidate(testCase, candidate),
    ),
    createManualFallback(testCase),
  ];
}

function createCandidate(
  testCase: MatrixCaseFixture,
  fixture: MatrixCandidateFixture,
): ImportCandidateResponseDto {
  const mediumType = toWorkType(fixture.mediumType ?? testCase.mediumType);
  const externalRefs = fixture.externalRefs ?? [];
  const providers = Array.from(
    new Set([
      ...externalRefs.map((externalRef) => externalRef.provider),
      fixture.sourceId,
    ]),
  ).filter((provider) => provider !== 'manual');

  return {
    author: fixture.author ?? '',
    catalogMatch: fixture.catalogMatch ?? null,
    confidence: fixture.sourceId === 'manual' ? 0.35 : 0.75,
    confidenceLabel: '후보',
    contributors: fixture.contributors ?? [],
    countLabel: '',
    description: '',
    existingRecord: fixture.existingRecord ?? null,
    externalId: fixture.id,
    externalRefs,
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: fixture.id,
    mediumType,
    note: '',
    reason: '',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: fixture.releaseYear ?? null,
    scoreBreakdown: [],
    sourceCoverage: {
      externalIdentityCount: externalRefs.length,
      providerCount: providers.length,
      providers,
      releaseCandidateCount: 0,
    },
    sourceId: fixture.sourceId,
    sourceLabel: fixture.sourceId,
    sourceUrl: externalRefs[0]?.url ?? '',
    subType: null,
    thumbnailUrl: '',
    title: fixture.title,
    titleAliases: fixture.titleAliases ?? [],
    type: mediumType,
  };
}

function createManualFallback(
  testCase: MatrixCaseFixture,
): ImportCandidateResponseDto {
  const id = testCase.expectedCandidate
    ? `manual-${testCase.id}`
    : testCase.expectedTopId;

  return createCandidate(testCase, {
    id,
    mediumType: testCase.mediumType,
    sourceId: 'manual',
    title: testCase.query,
  });
}

describe('import/search QA canonical matrix', () => {
  it('covers every required medium type, provider, assertion tag, and unique case id', () => {
    const caseIds = matrix.cases.map((testCase) => testCase.id);
    const mediumTypes = new Set(
      matrix.cases.map((testCase) => testCase.mediumType),
    );
    const providers = new Set(
      matrix.cases.flatMap((testCase) =>
        [
          testCase.expectedCandidate,
          ...(testCase.otherCandidates ?? []),
        ].flatMap((candidate) => (candidate ? [candidate.sourceId] : [])),
      ),
    );
    const tags = new Set(matrix.cases.flatMap((testCase) => testCase.tags));

    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect([...mediumTypes].sort()).toEqual(
      [...matrix.requiredMediaTypes].sort(),
    );
    expect([...providers].sort()).toEqual([...matrix.requiredProviders].sort());
    expect([...matrix.requiredProviders].sort()).toEqual(
      IMPORT_PROVIDER_VALUES.filter(
        (provider) => provider !== MANUAL_PROVIDER,
      ).sort(),
    );
    expect([...tags].sort()).toEqual([...matrix.requiredCoverageTags].sort());
  });

  it.each(matrix.cases)(
    'ranks the expected fixture for $id without live provider calls',
    (testCase) => {
      const candidates = buildCandidates(testCase);
      const merged = mergeImportCandidates(candidates);
      const ranked = rankImportCandidates({
        candidates: merged,
        mediumType: toWorkType(testCase.mediumType),
        query: testCase.query,
      });

      expect(ranked[0]).toEqual(
        expect.objectContaining({
          id: testCase.expectedTopId,
          mediumType: toWorkType(testCase.mediumType),
        }),
      );

      expect(ranked).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: 'manual',
          }),
        ]),
      );
    },
  );

  it.each(
    matrix.cases.filter((testCase) =>
      testCase.tags.includes('wrong_medium_guard'),
    ),
  )('demotes wrong-medium candidates for $id', (testCase) => {
    const ranked = rankImportCandidates({
      candidates: mergeImportCandidates(buildCandidates(testCase)),
      mediumType: toWorkType(testCase.mediumType),
      query: testCase.query,
    });
    const expectedIndex = ranked.findIndex(
      (candidate) => candidate.id === testCase.expectedTopId,
    );
    const wrongMediumIndexes = ranked
      .map((candidate, index) => ({ candidate, index }))
      .filter(
        ({ candidate }) =>
          candidate.sourceId !== 'manual' &&
          candidate.mediumType !== toWorkType(testCase.mediumType),
      )
      .map(({ index }) => index);

    expect(expectedIndex).toBeGreaterThanOrEqual(0);
    for (const wrongMediumIndex of wrongMediumIndexes) {
      expect(expectedIndex).toBeLessThan(wrongMediumIndex);
    }
  });

  it.each(
    matrix.cases.filter((testCase) => testCase.expectedMergedProviders),
  )('merges duplicate provider identities for $id', (testCase) => {
    const expectedMergedProviders = testCase.expectedMergedProviders ?? [];
    const merged = mergeImportCandidates(buildCandidates(testCase));
    const expected = merged.find(
      (candidate) => candidate.id === testCase.expectedTopId,
    );

    expect(expected).toEqual(
      expect.objectContaining({
        sourceCoverage: expect.objectContaining({
          providers: expect.arrayContaining(expectedMergedProviders),
          providerCount: expectedMergedProviders.length,
        }),
      }),
    );
    expect(expected?.externalRefs).toEqual(
      expect.arrayContaining(
        expectedMergedProviders.map((provider) =>
          expect.objectContaining({ provider }),
        ),
      ),
    );
  });

  it('keeps duplicate-detection fixture metadata visible on matching candidates', () => {
    const duplicateDetectionCases = matrix.cases.filter((testCase) =>
      testCase.tags.includes('duplicate_detection'),
    );

    expect(duplicateDetectionCases.length).toBeGreaterThan(0);

    for (const testCase of duplicateDetectionCases) {
      const ranked = rankImportCandidates({
        candidates: mergeImportCandidates(buildCandidates(testCase)),
        mediumType: toWorkType(testCase.mediumType),
        query: testCase.query,
      });

      expect(ranked[0]).toEqual(
        expect.objectContaining({
          catalogMatch: expect.objectContaining({
            id: expect.any(String),
          }),
          existingRecord: expect.objectContaining({
            id: expect.any(String),
            status: expect.any(String),
          }),
        }),
      );
    }
  });
});
