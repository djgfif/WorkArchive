export interface CatalogExternalRefInput {
  externalId: string;
  provider: string;
  rawType?: string;
  url?: string;
}

export interface CatalogReleaseCandidateInput {
  displayLabel?: string;
  externalRefs?: CatalogExternalRefInput[];
  isbn?: string | null;
  releaseDate?: Date | string | null;
  releaseType?: string;
  sequence?: number | null;
  summary?: string;
  thumbnailUrl?: string;
  title?: string;
}

export type NormalizedExternalRef = Required<CatalogExternalRefInput>;

export type NormalizedReleaseCandidate = {
  displayLabel: string;
  externalRefs: NormalizedExternalRef[];
  isbn: string | null;
  releaseDate: Date | null;
  releaseType: string;
  sequence: number | null;
  summary: string;
  thumbnailUrl: string;
  title: string;
};

export function normalizeCatalogReleaseCandidate(
  candidate: CatalogReleaseCandidateInput,
): NormalizedReleaseCandidate {
  const sequence =
    candidate.sequence !== undefined &&
    candidate.sequence !== null &&
    Number.isFinite(candidate.sequence)
      ? candidate.sequence
      : null;
  const title = candidate.title?.trim() ?? '';
  const displayLabel =
    candidate.displayLabel?.trim() || (sequence !== null ? `Vol. ${sequence}` : title);

  return {
    displayLabel,
    externalRefs: (candidate.externalRefs ?? [])
      .map((ref) => normalizeCatalogExternalRef(ref))
      .filter((ref): ref is NormalizedExternalRef => ref !== null),
    isbn: normalizeIsbn(candidate.isbn ?? null),
    releaseDate: normalizeDate(candidate.releaseDate ?? null),
    releaseType: candidate.releaseType?.trim() || 'volume',
    sequence,
    summary: candidate.summary?.trim() ?? '',
    thumbnailUrl: candidate.thumbnailUrl?.trim() ?? '',
    title,
  };
}

export function hasCatalogReleaseIdentity(
  candidate: Pick<
    NormalizedReleaseCandidate,
    'displayLabel' | 'externalRefs' | 'isbn' | 'sequence'
  >,
) {
  return (
    candidate.externalRefs.length > 0 ||
    candidate.isbn !== null ||
    (candidate.sequence !== null && candidate.displayLabel.length > 0)
  );
}

export function normalizeCatalogExternalRef(input: CatalogExternalRefInput) {
  const provider = input.provider.trim();
  const externalId = input.externalId.trim();

  if (!provider || !externalId) {
    return null;
  }

  return {
    externalId,
    provider,
    rawType: input.rawType?.trim() ?? '',
    url: input.url?.trim() ?? '',
  };
}

function normalizeDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^\d{4}$/.test(trimmedValue)) {
    return new Date(`${trimmedValue}-01-01T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}$/.test(trimmedValue)) {
    return new Date(`${trimmedValue}-01T00:00:00.000Z`);
  }

  const parsed = new Date(trimmedValue);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeIsbn(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();

  return normalized.length >= 10 ? normalized : null;
}
