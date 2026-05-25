import type {
  CatalogExternalRefInput,
  CatalogReleaseCandidateInput,
} from '../../catalog/catalog-ingestion.service';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';

type Contributor = ImportCandidateResponseDto['contributors'][number];
type NormalizedExternalRef = ImportCandidateResponseDto['externalRefs'][number];

export function normalizeImportCandidate(
  candidate: ImportCandidateResponseDto,
): ImportCandidateResponseDto {
  const releaseCandidates = candidate.releaseCandidates.map(
    normalizeReleaseCandidate,
  );
  const releaseYear =
    normalizeReleaseYear(candidate.releaseYear) ??
    firstReleaseYear(releaseCandidates);
  const contributors = dedupeContributors(
    candidate.contributors.map(normalizeContributor),
  );
  const author =
    normalizeDisplayText(candidate.author) || formatAuthor(contributors);
  const externalRefs = dedupeExternalRefs(
    candidate.externalRefs.map(normalizeExternalRef),
  );
  const sourceId = normalizeExternalRefPart(candidate.sourceId);

  return {
    ...candidate,
    author,
    contributors,
    countLabel: normalizeDisplayText(candidate.countLabel),
    description: normalizeDisplayText(stripHtml(candidate.description)),
    externalId: normalizeExternalId(candidate.externalId),
    externalRefs,
    formatLabel: normalizeDisplayText(candidate.formatLabel),
    genresText: normalizeDisplayText(candidate.genresText),
    note: normalizeDisplayText(candidate.note),
    reason: normalizeDisplayText(candidate.reason),
    relationsHint: dedupeRelationsHints(
      candidate.relationsHint.map((relationHint) => ({
        relationType: normalizeDisplayText(relationHint.relationType),
        targetTitle: normalizeDisplayText(relationHint.targetTitle),
      })),
    ),
    releaseCandidates,
    releaseYear,
    sourceCoverage: calculateSourceCoverage({
      externalRefs,
      releaseCandidates,
      sourceId,
    }),
    sourceId,
    sourceLabel: normalizeDisplayText(candidate.sourceLabel),
    sourceUrl: normalizeUrl(candidate.sourceUrl),
    thumbnailUrl: normalizeThumbnailUrl(candidate.thumbnailUrl),
    title: normalizeDisplayText(stripHtml(candidate.title)),
    titleAliases: dedupeTitleAliases([
      candidate.title,
      ...(candidate.titleAliases ?? []),
      ...releaseCandidates
        .map((releaseCandidate) => releaseCandidate.title ?? '')
        .filter(Boolean),
    ]),
  };
}

export function calculateSourceCoverage(input: {
  externalRefs: CatalogExternalRefInput[];
  releaseCandidates: CatalogReleaseCandidateInput[];
  sourceId: string;
  sourceIds?: string[];
}): ImportCandidateResponseDto['sourceCoverage'] {
  const providers = new Set<string>();

  if (input.sourceId) {
    providers.add(input.sourceId);
  }

  for (const sourceId of input.sourceIds ?? []) {
    if (sourceId) {
      providers.add(sourceId);
    }
  }

  for (const externalRef of input.externalRefs) {
    const normalized = normalizeExternalRef(externalRef);

    if (normalized.provider) {
      providers.add(normalized.provider);
    }
  }

  for (const releaseCandidate of input.releaseCandidates) {
    for (const externalRef of releaseCandidate.externalRefs ?? []) {
      const normalized = normalizeExternalRef(externalRef);

      if (normalized.provider) {
        providers.add(normalized.provider);
      }
    }
  }

  return {
    externalIdentityCount:
      input.externalRefs.length +
      input.releaseCandidates.reduce((count, releaseCandidate) => {
        return count + (releaseCandidate.externalRefs?.length ?? 0);
      }, 0),
    providerCount: providers.size,
    providers: [...providers],
    releaseCandidateCount: input.releaseCandidates.length,
  };
}

export function normalizeIsbn(value: string | null | undefined) {
  const candidates = extractIsbnCandidates(value);
  const isbn13 = candidates.find((candidate) => candidate.length === 13);

  if (isbn13) {
    return isbn13;
  }

  return candidates.find((candidate) => candidate.length === 10) ?? null;
}

export function normalizeExternalRef(
  externalRef: CatalogExternalRefInput,
): NormalizedExternalRef {
  return {
    externalId: normalizeExternalId(externalRef.externalId),
    provider: normalizeExternalRefPart(externalRef.provider),
    rawType: normalizeExternalRefPart(externalRef.rawType ?? ''),
    url: normalizeUrl(externalRef.url ?? ''),
  };
}

export function getNormalizedExternalRefKey(
  externalRef: CatalogExternalRefInput,
) {
  const normalized = normalizeExternalRef(externalRef);

  return normalized.provider && normalized.externalId
    ? `${normalized.provider}:${normalized.rawType ?? ''}:${normalized.externalId}`
    : null;
}

export function normalizeReleaseDate(value: Date | string | null | undefined) {
  const normalized =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : normalizeDisplayText(value ?? '');

  if (!normalized) {
    return null;
  }

  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  const compactDate = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (compactDate) {
    return `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
  }

  const yearMonth = normalized.match(/^(\d{4})-(\d{2})$/);

  if (yearMonth) {
    return `${yearMonth[1]}-${yearMonth[2]}`;
  }

  const year = normalized.match(/^(18|19|20)\d{2}$/);

  return year ? year[0] : normalized;
}

export function normalizeReleaseYear(value: number | null | undefined) {
  return typeof value === 'number' && value >= 1800 && value <= 2099
    ? value
    : null;
}

export function parseNormalizedReleaseYear(value: string) {
  const normalizedDate = normalizeReleaseDate(value);
  const match = normalizedDate?.match(/\b(18|19|20)\d{2}\b/);

  return match ? Number(match[0]) : null;
}

export function normalizeDisplayText(value: string) {
  return decodeBasicHtmlEntities(value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

export function normalizeImportTitleSignal(value: string) {
  return normalizeDisplayText(stripHtml(value))
    .toLowerCase()
    .replace(
      /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|（[^）]*）|【[^】]*】|「[^」]*」|『[^』]*』/gu,
      '',
    )
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function normalizeReleaseCandidate(
  releaseCandidate: CatalogReleaseCandidateInput,
): CatalogReleaseCandidateInput {
  const externalRefs = dedupeExternalRefs(
    (releaseCandidate.externalRefs ?? []).map(normalizeExternalRef),
  );
  const displayLabel = normalizeOptionalText(releaseCandidate.displayLabel);
  const releaseType = normalizeOptionalText(releaseCandidate.releaseType);
  const summary = normalizeOptionalText(releaseCandidate.summary);
  const thumbnailUrl = normalizeOptionalThumbnailUrl(
    releaseCandidate.thumbnailUrl,
  );
  const title = normalizeOptionalText(releaseCandidate.title);

  return {
    externalRefs,
    isbn: normalizeIsbn(releaseCandidate.isbn),
    releaseDate: normalizeReleaseDate(releaseCandidate.releaseDate),
    sequence: normalizeSequence(releaseCandidate.sequence),
    ...(displayLabel ? { displayLabel } : {}),
    ...(releaseType ? { releaseType } : {}),
    ...(summary ? { summary } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(title ? { title } : {}),
  };
}

function normalizeContributor(contributor: Contributor): Contributor {
  return {
    name: normalizeDisplayText(contributor.name),
    role: normalizeDisplayText(contributor.role).toLowerCase(),
  };
}

function dedupeContributors(contributors: Contributor[]) {
  const contributorMap = new Map<string, Contributor>();

  for (const contributor of contributors) {
    const key = `${contributor.role}:${contributor.name.toLowerCase()}`;

    if (!contributor.name || contributorMap.has(key)) {
      continue;
    }

    contributorMap.set(key, contributor);
  }

  return [...contributorMap.values()];
}

function dedupeExternalRefs(externalRefs: CatalogExternalRefInput[]) {
  const externalRefMap = new Map<string, NormalizedExternalRef>();

  for (const externalRef of externalRefs) {
    const key = getNormalizedExternalRefKey(externalRef);

    if (!key || externalRefMap.has(key)) {
      continue;
    }

    externalRefMap.set(key, normalizeExternalRef(externalRef));
  }

  return [...externalRefMap.values()];
}

function dedupeRelationsHints(
  relationsHints: ImportCandidateResponseDto['relationsHint'],
) {
  const relationMap = new Map<
    string,
    ImportCandidateResponseDto['relationsHint'][number]
  >();

  for (const relationsHint of relationsHints) {
    const key = `${relationsHint.relationType.toLowerCase()}:${relationsHint.targetTitle.toLowerCase()}`;

    if (!relationsHint.targetTitle || relationMap.has(key)) {
      continue;
    }

    relationMap.set(key, relationsHint);
  }

  return [...relationMap.values()];
}

function dedupeTitleAliases(values: string[]) {
  const aliases = new Map<string, string>();

  for (const value of values.flatMap(expandTitleAliases)) {
    const alias = normalizeDisplayText(stripHtml(value));
    const key = normalizeImportTitleSignal(alias);

    if (!alias || !key || aliases.has(key)) {
      continue;
    }

    aliases.set(key, alias);
  }

  return [...aliases.values()];
}

function expandTitleAliases(value: string) {
  const normalized = normalizeDisplayText(stripHtml(value));
  const withoutBracketedSuffix = normalized.replace(
    /\s*(\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】)\s*$/u,
    '',
  );
  const subtitleSplit = normalized.split(/\s+[-–—:：]\s+/u)[0] ?? '';

  return [normalized, withoutBracketedSuffix, subtitleSplit].filter(Boolean);
}

function extractIsbnCandidates(value: string | null | undefined) {
  const rawValue = normalizeDisplayText(value ?? '');

  if (!rawValue) {
    return [];
  }

  const compactValue = rawValue.replace(/[^0-9Xx]/g, '').toUpperCase();
  const candidates = [
    ...[...compactValue.matchAll(/97[89]\d{10}/g)].map((match) => match[0]),
    ...rawValue
      .split(/[,;/|]|\s+/g)
      .map((candidate) => candidate.replace(/[^0-9Xx]/g, '').toUpperCase())
      .filter(
        (candidate) => candidate.length === 10 || candidate.length === 13,
      ),
  ];

  return [...new Set(candidates)];
}

function firstReleaseYear(releaseCandidates: CatalogReleaseCandidateInput[]) {
  for (const releaseCandidate of releaseCandidates) {
    const releaseDate = releaseCandidate.releaseDate;
    const releaseYear =
      releaseDate instanceof Date
        ? releaseDate.getFullYear()
        : parseNormalizedReleaseYear(releaseDate ?? '');

    if (releaseYear !== null) {
      return releaseYear;
    }
  }

  return null;
}

function normalizeExternalId(value: string) {
  return normalizeDisplayText(value);
}

function normalizeExternalRefPart(value: string) {
  return normalizeDisplayText(value).toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeDisplayText(value ?? '');

  return normalized || undefined;
}

function normalizeOptionalThumbnailUrl(value: string | null | undefined) {
  const normalized = normalizeThumbnailUrl(value ?? '');

  return normalized || undefined;
}

function normalizeUrl(value: string) {
  return normalizeDisplayText(value);
}

function normalizeThumbnailUrl(value: string) {
  const normalized = normalizeUrl(value);

  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }

  if (normalized.startsWith('http://')) {
    return `https://${normalized.slice('http://'.length)}`;
  }

  return normalized;
}

function normalizeSequence(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatAuthor(contributors: Contributor[]) {
  return contributors.map((entry) => entry.name).join(', ');
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
