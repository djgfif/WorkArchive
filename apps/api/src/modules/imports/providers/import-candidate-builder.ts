import { WorkType } from '@prisma/client';

import type {
  CatalogExternalRefInput,
  CatalogReleaseCandidateInput,
} from '../../catalog/catalog-ingestion.service';
import {
  normalizeImportCandidate,
  normalizeImportTitleSignal,
  normalizeIsbn,
  normalizeReleaseDate,
  parseNormalizedReleaseYear,
  stripHtml as stripHtmlTags,
} from '../candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import type { ImportProvider } from '../imports.constants';
import { PROVIDERS } from './import-provider-adapter';

export function buildImportCandidate(
  input: Partial<ImportCandidateResponseDto> & {
    externalId: string;
    provider: ImportProvider;
    rawType?: string;
    title: string;
    type: WorkType;
  },
): ImportCandidateResponseDto {
  const contributors = input.contributors ?? toContributorList(input.author);
  const rawType = input.rawType ?? input.type;

  return normalizeImportCandidate({
    author: input.author ?? contributors.map((entry) => entry.name).join(', '),
    catalogMatch: null,
    confidence: input.confidence ?? 0.5,
    confidenceLabel: input.confidenceLabel ?? '후보',
    contributors,
    countLabel: input.countLabel ?? '',
    description: input.description ?? '',
    existingRecord: null,
    externalId: input.externalId,
    externalRefs: input.externalRefs ?? [
      {
        externalId: input.externalId,
        provider: input.provider,
        rawType,
        url: input.sourceUrl ?? '',
      },
    ],
    formatLabel: input.formatLabel ?? getFormatLabel(input.type),
    franchiseName: input.franchiseName ?? null,
    genresText: input.genresText ?? '',
    id: input.id ?? `${input.provider}:${input.externalId}`,
    mediumType: input.type,
    note: input.note ?? '',
    reason: input.reason ?? '',
    releaseCandidates: input.releaseCandidates ?? [],
    relationsHint: input.relationsHint ?? [],
    releaseYear: input.releaseYear ?? null,
    scoreBreakdown: input.scoreBreakdown ?? [],
    sourceCoverage: {
      externalIdentityCount: 0,
      providerCount: 0,
      providers: [],
      releaseCandidateCount: 0,
    },
    sourceId: input.provider,
    sourceLabel: input.sourceLabel ?? PROVIDERS[input.provider].label,
    sourceUrl: input.sourceUrl ?? '',
    subType: input.subType ?? null,
    thumbnailUrl: input.thumbnailUrl ?? '',
    title: input.title,
    titleAliases: input.titleAliases ?? [],
    type: input.type,
  });
}

export function buildBookReleaseCandidates(input: {
  externalId?: string;
  isbn?: string | null;
  provider: string;
  releaseDate?: string | null;
  sequence?: number | null;
  thumbnailUrl?: string;
  title: string;
  url?: string;
}): CatalogReleaseCandidateInput[] {
  const title = normalizeWhitespace(input.title);

  if (!title) {
    return [];
  }

  const sequence = input.sequence ?? extractVolumeSequence(title);
  const isbn = normalizeIsbn(input.isbn ?? null);
  const externalId = input.externalId?.trim() ?? '';
  const externalRefs: CatalogExternalRefInput[] = externalId
    ? [
        {
          externalId,
          provider: input.provider,
          rawType: 'volume',
          url: input.url?.trim() ?? '',
        },
      ]
    : [];

  if (externalRefs.length === 0 && !isbn && sequence === null) {
    return [];
  }

  return [
    {
      displayLabel: sequence !== null ? `Vol. ${sequence}` : title,
      externalRefs,
      isbn,
      releaseDate: normalizeReleaseDate(input.releaseDate ?? null),
      releaseType: 'volume',
      sequence,
      thumbnailUrl: input.thumbnailUrl?.trim() ?? '',
      title,
    },
  ];
}

export function buildExternalRefUrl(input: {
  externalId: string;
  provider: string;
  rawType: string;
}) {
  const encoded = encodeURIComponent(input.externalId);

  if (input.provider === 'imdb') {
    return `https://www.imdb.com/title/${encoded}/`;
  }

  if (input.provider === 'tmdb') {
    return `https://www.themoviedb.org/${input.rawType}/${encoded}`;
  }

  if (input.provider === 'anilist') {
    return `https://anilist.co/${input.rawType}/${encoded}`;
  }

  if (input.provider === 'open_library') {
    return input.externalId.startsWith('/')
      ? `https://openlibrary.org${input.externalId}`
      : `https://openlibrary.org/works/${encoded}`;
  }

  if (input.provider === 'google_books') {
    return `https://books.google.com/books?id=${encoded}`;
  }

  return '';
}

export function dedupeRawExternalRefs(
  externalRefs: CatalogExternalRefInput[],
): ImportCandidateResponseDto['externalRefs'] {
  const refs = new Map<
    string,
    ImportCandidateResponseDto['externalRefs'][number]
  >();

  for (const ref of externalRefs) {
    const key = `${ref.provider}:${ref.rawType ?? ''}:${ref.externalId}`;

    if (!ref.provider || !ref.externalId || refs.has(key)) {
      continue;
    }

    refs.set(key, {
      externalId: ref.externalId,
      provider: ref.provider,
      rawType: ref.rawType ?? '',
      url: ref.url ?? '',
    });
  }

  return [...refs.values()];
}

export function uniqueNonEmpty(values: string[]) {
  const unique = new Map<string, string>();

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    const key = normalizeImportTitleSignal(normalized);

    if (!normalized || unique.has(key)) {
      continue;
    }

    unique.set(key, normalized);
  }

  return [...unique.values()];
}

export function mapBookWorkType(categoryName: string, title = '') {
  const searchable = `${categoryName} ${title}`;

  if (
    searchable.includes('라이트노벨') ||
    searchable.includes('라이트 노벨')
  ) {
    return WorkType.light_novel;
  }

  if (
    searchable.includes('만화') ||
    searchable.toLowerCase().includes('manga') ||
    searchable.toLowerCase().includes('comic')
  ) {
    return WorkType.manga;
  }

  if (
    searchable.includes('소설') ||
    searchable.toLowerCase().includes('novel')
  ) {
    return WorkType.novel;
  }

  return WorkType.novel;
}

export function getFormatLabel(type: WorkType) {
  switch (type) {
    case WorkType.light_novel:
      return '라이트노벨';
    case WorkType.novel:
      return '소설';
    case WorkType.manga:
      return '만화';
    case WorkType.anime:
      return '애니';
    case WorkType.movie:
      return '영화';
    case WorkType.drama:
      return '드라마';
    case WorkType.web_novel:
      return '웹소설';
    case WorkType.webtoon:
      return '웹툰';
    default:
      return '기타';
  }
}

export function toGenresText(categoryName: string) {
  const parts = categoryName
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
  const meaningfulParts = parts.length > 1 ? parts.slice(1) : parts;

  return meaningfulParts.slice(-3).join(', ');
}

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeProviderSearchQuery(query: string) {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function stripHtml(value: string) {
  return stripHtmlTags(value).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export function parseYear(value: string) {
  return parseNormalizedReleaseYear(value);
}

function toContributorList(author?: string) {
  return (author ?? '')
    .split(/[,;/]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((name) => ({
      name,
      role: 'author',
    }));
}

function extractVolumeSequence(title: string) {
  const patterns = [
    /(?:vol(?:ume)?\.?\s*|#)\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:권|巻|册|冊)/u,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const sequence = Number.parseFloat(match[1]);

    if (Number.isFinite(sequence)) {
      return sequence;
    }
  }

  return null;
}
