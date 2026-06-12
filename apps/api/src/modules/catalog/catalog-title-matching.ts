import { CatalogVerificationStatus } from '@prisma/client';

export interface CatalogTitleMatchContributor {
  contributor: {
    displayName: string;
  };
}

export interface CatalogTitleMatchCandidate {
  aliases: string[];
  canonicalTitle: string;
  contributors: CatalogTitleMatchContributor[];
  displayTitle: string;
  originalTitle: string | null;
  releaseYear: number | null;
  verificationStatus: CatalogVerificationStatus;
}

export interface ContributorMatchInput {
  name: string;
}

export function pickBestCatalogTitleMatch<T extends CatalogTitleMatchCandidate>(
  titles: T[],
  displayTitle: string,
  releaseYear: number | null,
  contributorHints: ContributorMatchInput[],
) {
  const normalizedTitle = normalizeForCatalogMatch(displayTitle);
  const normalizedContributorHints = contributorHints
    .map((entry) => normalizeForCatalogMatch(entry.name))
    .filter(Boolean);
  let bestMatch: T | null = null;
  let bestScore = -1;

  for (const title of titles) {
    if (!hasMatchingCatalogTitleName(title, normalizedTitle)) {
      continue;
    }

    if (
      releaseYear !== null &&
      title.releaseYear !== null &&
      Math.abs(title.releaseYear - releaseYear) > 1
    ) {
      continue;
    }

    let score = 10 + getCatalogVerificationScore(title.verificationStatus);

    if (releaseYear !== null && title.releaseYear === releaseYear) {
      score += 4;
    }

    if (normalizedContributorHints.length > 0) {
      const contributorNames = title.contributors
        .map((entry) => normalizeForCatalogMatch(entry.contributor.displayName))
        .filter(Boolean);
      const overlapCount = normalizedContributorHints.filter((hint) =>
        contributorNames.includes(hint),
      ).length;

      if (overlapCount === 0) {
        continue;
      }

      score += overlapCount * 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = title;
    }
  }

  return bestMatch;
}

export function hasMatchingCatalogTitleName(
  title: Pick<
    CatalogTitleMatchCandidate,
    'aliases' | 'canonicalTitle' | 'displayTitle' | 'originalTitle'
  >,
  normalizedTitle: string,
) {
  if (!normalizedTitle) {
    return false;
  }

  const candidates = [
    title.canonicalTitle,
    title.displayTitle,
    title.originalTitle ?? '',
    ...title.aliases,
  ];

  return candidates.some(
    (candidate) => normalizeForCatalogMatch(candidate) === normalizedTitle,
  );
}

export function getCatalogVerificationScore(status: CatalogVerificationStatus) {
  switch (status) {
    case CatalogVerificationStatus.verified:
      return 4;
    case CatalogVerificationStatus.pending:
      return 2;
    case CatalogVerificationStatus.draft:
      return 1;
    default:
      return 0;
  }
}

export function normalizeForCatalogMatch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
