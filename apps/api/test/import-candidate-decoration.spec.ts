import { CatalogVerificationStatus, WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import {
  decorateImportCandidates,
  type ImportCandidateCatalogMatcher,
  type ImportCandidateExistingRecordReader,
} from '../src/modules/imports/import-candidate-decoration';
import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';

function candidate(
  overrides: Partial<ImportCandidateResponseDto> = {},
): ImportCandidateResponseDto {
  return {
    author: 'Frank Herbert',
    catalogMatch: null,
    confidence: 0.8,
    confidenceLabel: '높음',
    contributors: [
      {
        name: 'Frank Herbert',
        role: 'author',
      },
    ],
    countLabel: '1965',
    description: 'Novel',
    existingRecord: null,
    externalId: 'OL123W',
    externalRefs: [
      {
        externalId: 'OL123W',
        provider: 'open_library',
        rawType: 'work',
        url: 'https://openlibrary.org/works/OL123W',
      },
    ],
    formatLabel: '소설',
    franchiseName: 'Dune',
    genresText: '',
    id: 'open_library:OL123W',
    mediumType: WorkType.novel,
    note: '',
    reason: '검색 결과',
    relationsHint: [],
    releaseCandidates: [
      {
        displayLabel: 'Dune',
        externalRefs: [],
        isbn: null,
        releaseDate: '1965-01-01',
        releaseType: 'book',
        sequence: 1,
        summary: '',
        thumbnailUrl: '',
        title: 'Dune',
      },
    ],
    releaseYear: 1965,
    scoreBreakdown: [],
    sourceCoverage: {
      externalIdentityCount: 1,
      providerCount: 1,
      providers: ['open_library'],
      releaseCandidateCount: 1,
    },
    sourceId: 'open_library',
    sourceLabel: 'Open Library',
    sourceUrl: 'https://openlibrary.org/works/OL123W',
    subType: null,
    thumbnailUrl: '',
    title: 'Dune',
    titleAliases: ['듄'],
    type: WorkType.novel,
    ...overrides,
  };
}

function matcher(
  findCatalogMatchForImportCandidate: ImportCandidateCatalogMatcher['findCatalogMatchForImportCandidate'],
): ImportCandidateCatalogMatcher {
  return {
    findCatalogMatchForImportCandidate,
  };
}

function recordReader(
  findFirst: ImportCandidateExistingRecordReader['userWorkRecord']['findFirst'],
): ImportCandidateExistingRecordReader {
  return {
    userWorkRecord: {
      findFirst,
    },
  };
}

describe('decorateImportCandidates', () => {
  it('uses an existing catalog match and decorates authenticated duplicates', async () => {
    const catalogMatch = {
      id: 'catalog-dune',
      title: 'Dune',
      verificationStatus: 'verified',
    };
    const findCatalogMatch = jest.fn<
      ImportCandidateCatalogMatcher['findCatalogMatchForImportCandidate']
    >();
    const findFirst = jest.fn<
      ImportCandidateExistingRecordReader['userWorkRecord']['findFirst']
    >(async () => ({
      id: 'record-dune',
      status: 'completed',
    }));

    await expect(
      decorateImportCandidates({
        candidates: [candidate({ catalogMatch })],
        catalogMatcher: matcher(findCatalogMatch),
        recordReader: recordReader(findFirst),
        userId: 'user-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        catalogMatch,
        existingRecord: {
          id: 'record-dune',
          status: 'completed',
        },
      }),
    ]);

    expect(findCatalogMatch).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        catalogTitleId: 'catalog-dune',
        deletedAt: null,
        userId: 'user-1',
      },
      select: {
        id: true,
        status: true,
      },
    });
  });

  it('looks up catalog matches from candidate identity fields', async () => {
    const catalogMatch = {
      id: 'catalog-dune',
      title: 'Dune',
      verificationStatus: CatalogVerificationStatus.verified,
    };
    const findCatalogMatch = jest.fn<
      ImportCandidateCatalogMatcher['findCatalogMatchForImportCandidate']
    >(async () => catalogMatch);
    const findFirst = jest.fn<
      ImportCandidateExistingRecordReader['userWorkRecord']['findFirst']
    >(async () => null);

    await expect(
      decorateImportCandidates({
        candidates: [candidate()],
        catalogMatcher: matcher(findCatalogMatch),
        recordReader: recordReader(findFirst),
        userId: 'user-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        catalogMatch,
        existingRecord: null,
      }),
    ]);

    expect(findCatalogMatch).toHaveBeenCalledWith({
      contributorNames: ['Frank Herbert'],
      externalRefs: candidate().externalRefs,
      franchiseName: 'Dune',
      mediumType: WorkType.novel,
      releaseCandidates: candidate().releaseCandidates,
      releaseYear: 1965,
      title: 'Dune',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          catalogTitleId: 'catalog-dune',
        }),
      }),
    );
  });

  it('does not read existing records for guests or unmatched candidates', async () => {
    const findCatalogMatch = jest.fn<
      ImportCandidateCatalogMatcher['findCatalogMatchForImportCandidate']
    >(async () => null);
    const findFirst = jest.fn<
      ImportCandidateExistingRecordReader['userWorkRecord']['findFirst']
    >(async () => null);

    await expect(
      decorateImportCandidates({
        candidates: [candidate()],
        catalogMatcher: matcher(findCatalogMatch),
        recordReader: recordReader(findFirst),
        userId: null,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        catalogMatch: null,
        existingRecord: null,
      }),
    ]);

    expect(findFirst).not.toHaveBeenCalled();
  });
});
