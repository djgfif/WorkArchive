import { CatalogVerificationStatus } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  getCatalogVerificationScore,
  hasMatchingCatalogTitleName,
  normalizeForCatalogMatch,
  pickBestCatalogTitleMatch,
  type CatalogTitleMatchCandidate,
} from '../src/modules/catalog/catalog-title-matching';

function createCandidate(
  overrides: Partial<CatalogTitleMatchCandidate> = {},
): CatalogTitleMatchCandidate {
  return {
    aliases: [],
    canonicalTitle: 'Dune',
    contributors: [],
    displayTitle: 'Dune',
    originalTitle: null,
    releaseYear: null,
    verificationStatus: CatalogVerificationStatus.draft,
    ...overrides,
  };
}

describe('catalog title matching helpers', () => {
  it('normalizes punctuation, width, parenthetical notes, and spacing', () => {
    expect(normalizeForCatalogMatch('  Ｄｕｎｅ: Part One (2021)  ')).toBe(
      'dune part one',
    );
  });

  it('matches canonical, display, original, or alias titles by normalized name', () => {
    expect(
      hasMatchingCatalogTitleName(
        createCandidate({
          aliases: ['Dune Messiah'],
          canonicalTitle: 'Dune',
          displayTitle: 'Dune',
          originalTitle: 'Dune 2',
        }),
        normalizeForCatalogMatch('dune messiah'),
      ),
    ).toBe(true);
    expect(
      hasMatchingCatalogTitleName(
        createCandidate({
          aliases: [],
          canonicalTitle: 'Dune',
          displayTitle: 'Dune',
          originalTitle: null,
        }),
        '',
      ),
    ).toBe(false);
  });

  it('scores verified titles above draft titles when other hints tie', () => {
    const draft = createCandidate({
      id: 'draft',
      verificationStatus: CatalogVerificationStatus.draft,
    } as Partial<CatalogTitleMatchCandidate> & { id: string });
    const verified = createCandidate({
      id: 'verified',
      verificationStatus: CatalogVerificationStatus.verified,
    } as Partial<CatalogTitleMatchCandidate> & { id: string });

    expect(
      pickBestCatalogTitleMatch([draft, verified], 'Dune', null, []),
    ).toBe(verified);
  });

  it('filters title matches by release year tolerance and contributor overlap', () => {
    const wrongYear = createCandidate({
      displayTitle: 'Dune',
      releaseYear: 1975,
    });
    const wrongContributor = createCandidate({
      contributors: [
        {
          contributor: {
            displayName: 'Someone Else',
          },
        },
      ],
      displayTitle: 'Dune',
      releaseYear: 1965,
    });
    const match = createCandidate({
      contributors: [
        {
          contributor: {
            displayName: 'Frank Herbert',
          },
        },
      ],
      displayTitle: 'Dune',
      releaseYear: 1965,
    });

    expect(
      pickBestCatalogTitleMatch(
        [wrongYear, wrongContributor, match],
        'Dune',
        1965,
        [{ name: 'Frank Herbert' }],
      ),
    ).toBe(match);
  });

  it('keeps verification status scoring explicit', () => {
    expect(getCatalogVerificationScore(CatalogVerificationStatus.verified)).toBe(4);
    expect(getCatalogVerificationScore(CatalogVerificationStatus.pending)).toBe(2);
    expect(getCatalogVerificationScore(CatalogVerificationStatus.draft)).toBe(1);
    expect(getCatalogVerificationScore(CatalogVerificationStatus.merged)).toBe(0);
  });
});
