import {
  type CatalogRelease,
  type CatalogVerificationStatus,
  type Prisma,
} from '@prisma/client';

import type { NormalizedReleaseCandidate } from './catalog-ingestion-normalization';

export interface CatalogTitleUpdateSource {
  country: string | null;
  franchiseId: string | null;
  releaseYear: number | null;
  subType: string | null;
  summary: string;
  thumbnailUrl: string;
}

export interface CatalogMatchViewSource {
  displayTitle: string;
  id: string;
  verificationStatus: CatalogVerificationStatus;
}

export interface CatalogMatchView {
  id: string;
  title: string;
  verificationStatus: CatalogVerificationStatus;
}

export function buildCatalogTitleUpdateData(
  existing: CatalogTitleUpdateSource,
  input: CatalogTitleUpdateSource,
): Prisma.CatalogTitleUncheckedUpdateInput {
  const data: Prisma.CatalogTitleUncheckedUpdateInput = {};

  if (!existing.franchiseId && input.franchiseId) {
    data.franchiseId = input.franchiseId;
  }

  if (!existing.country && input.country) {
    data.country = input.country;
  }

  if (existing.releaseYear === null && input.releaseYear !== null) {
    data.releaseYear = input.releaseYear;
  }

  if (!existing.subType && input.subType) {
    data.subType = input.subType;
  }

  if (!existing.summary.trim() && input.summary) {
    data.summary = input.summary;
  }

  if (!existing.thumbnailUrl.trim() && input.thumbnailUrl) {
    data.thumbnailUrl = input.thumbnailUrl;
  }

  return data;
}

export function buildCatalogReleaseCreateData(
  candidate: Omit<NormalizedReleaseCandidate, 'externalRefs'>,
) {
  return {
    displayLabel: candidate.displayLabel,
    isbn: candidate.isbn,
    releaseDate: candidate.releaseDate,
    releaseType: candidate.releaseType,
    sequence: candidate.sequence,
    summary: candidate.summary,
    thumbnailUrl: candidate.thumbnailUrl,
    title: candidate.title,
  };
}

export function buildCatalogReleaseUpdateData(
  existing: CatalogRelease,
  candidate: Omit<NormalizedReleaseCandidate, 'externalRefs'>,
) {
  return {
    displayLabel: candidate.displayLabel || existing.displayLabel,
    isbn: candidate.isbn ?? existing.isbn,
    releaseDate: candidate.releaseDate ?? existing.releaseDate,
    releaseType: candidate.releaseType || existing.releaseType,
    sequence: candidate.sequence ?? existing.sequence,
    summary: candidate.summary || existing.summary,
    thumbnailUrl: candidate.thumbnailUrl || existing.thumbnailUrl,
    title: candidate.title || existing.title,
  };
}

export function toCatalogMatchView(title: CatalogMatchViewSource): CatalogMatchView {
  return {
    id: title.id,
    title: title.displayTitle,
    verificationStatus: title.verificationStatus,
  };
}
