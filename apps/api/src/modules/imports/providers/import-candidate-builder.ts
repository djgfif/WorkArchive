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
import {
  ALADIN_PROVIDER,
  ANILIST_PROVIDER,
  BRAVE_SEARCH_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
  type ImportProvider,
} from '../imports.constants';
import { PROVIDERS } from './import-provider-adapter';
import { ALADIN_ATTRIBUTION } from './import-provider-config';

export type UnknownRecord = Record<string, unknown>;

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

export function buildExternalWebSearchCandidate(input: {
  confidence: number;
  description: string;
  idPrefix: ImportProvider;
  note: string;
  provider: ImportProvider;
  reason: string;
  requestedMediumType: WorkType | undefined;
  sourceLabel: string;
  title: string;
  url: string;
}) {
  const rawTitle = stripHtml(input.title);
  const title = normalizeWebSearchTitle(rawTitle);
  const sourceUrl = input.url.trim();
  const description = normalizeWhitespace(stripHtml(input.description));
  const type = inferWebSearchWorkType({
    description,
    requestedMediumType: input.requestedMediumType,
    title,
    url: sourceUrl,
  });

  if (!title || !type || !sourceUrl) {
    return null;
  }

  const sourceLabel = getWebSourceLabel(sourceUrl) || input.sourceLabel;

  return buildImportCandidate({
    confidence: input.confidence,
    confidenceLabel:
      input.confidence >= 0.76
        ? `${input.sourceLabel} 상위`
        : `${input.sourceLabel} 후보`,
    countLabel: sourceLabel,
    description,
    externalId: sourceUrl,
    formatLabel: getFormatLabel(type),
    id: `${input.idPrefix}:${sourceUrl}`,
    note: input.note,
    provider: input.provider,
    reason: input.reason,
    sourceLabel: input.sourceLabel,
    sourceUrl,
    title,
    titleAliases: [rawTitle, title].filter(Boolean),
    type,
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

export function buildGeneralWebSearchQuery(
  query: string,
  mediumType?: WorkType,
) {
  const normalizedQuery = normalizeProviderSearchQuery(query);

  if (mediumType === WorkType.web_novel) {
    return `"${normalizedQuery}" 웹소설 OR 소설`;
  }

  if (mediumType === WorkType.webtoon) {
    return `"${normalizedQuery}" 웹툰 OR 만화`;
  }

  if (mediumType === WorkType.anime) {
    return `"${normalizedQuery}" anime OR 애니`;
  }

  return `"${normalizedQuery}" 웹소설 OR 웹툰 OR 애니`;
}

export function normalizeWebSearchTitle(value: string) {
  return normalizeWhitespace(value)
    .replace(
      /\s*(?:[-|:]\s*)?(?:네이버\s*시리즈|네이버\s*웹툰|카카오페이지|카카오\s*웹툰|리디|문피아|노벨피아|조아라)\s*$/iu,
      '',
    )
    .replace(
      /\s*(?:\(?\s*(?:외전|특별편|개정판|완전판|번외편|후일담|시즌\s*\d+)\s*\)?|\d+(?:\.\d+)?\s*(?:권|화|회|부)|vol(?:ume)?\.?\s*\d+)\s*$/iu,
      '',
    )
    .trim();
}

export function inferWebSearchWorkType(input: {
  description: string;
  requestedMediumType: WorkType | undefined;
  title: string;
  url: string;
}) {
  if (
    input.requestedMediumType === WorkType.web_novel ||
    input.requestedMediumType === WorkType.webtoon
  ) {
    return input.requestedMediumType;
  }

  const hostname = readHostname(input.url);
  const searchable = `${input.title} ${input.description}`.toLowerCase();

  if (
    hostname === 'comic.naver.com' ||
    hostname === 'webtoon.kakao.com' ||
    searchable.includes('웹툰')
  ) {
    return WorkType.webtoon;
  }

  if (
    hostname === 'series.naver.com' ||
    hostname === 'page.kakao.com' ||
    hostname.endsWith('ridibooks.com') ||
    hostname.endsWith('munpia.com') ||
    hostname.endsWith('novelpia.com') ||
    hostname.endsWith('joara.com') ||
    searchable.includes('웹소설')
  ) {
    return WorkType.web_novel;
  }

  return null;
}

export function getWebSourceLabel(url: string) {
  const hostname = readHostname(url);

  if (hostname === 'series.naver.com') {
    return 'Naver Series';
  }

  if (hostname === 'comic.naver.com') {
    return 'Naver Webtoon';
  }

  if (hostname === 'page.kakao.com') {
    return 'Kakao Page';
  }

  if (hostname === 'webtoon.kakao.com') {
    return 'Kakao Webtoon';
  }

  if (hostname.endsWith('ridibooks.com')) {
    return 'Ridi';
  }

  if (hostname.endsWith('munpia.com')) {
    return 'Munpia';
  }

  if (hostname.endsWith('novelpia.com')) {
    return 'Novelpia';
  }

  if (hostname.endsWith('joara.com')) {
    return 'Joara';
  }

  return hostname;
}

export function readHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function stripHtml(value: string) {
  return stripHtmlTags(value).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export function mapAladinItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readString(item.title).trim();

  if (!title) {
    return null;
  }

  const externalId =
    readString(item.itemId) ||
    readString(item.isbn13) ||
    readString(item.isbn) ||
    title;
  const categoryName = readString(item.categoryName);
  const publisher = readString(item.publisher);
  const publishedAt = readString(item.pubDate);
  const type = mapBookWorkType(categoryName, title);
  const sourceUrl = readString(item.link).trim();
  const thumbnailUrl = readString(item.cover).trim();

  return buildImportCandidate({
    author: readString(item.author).trim(),
    confidence: index === 0 ? 0.86 : 0.68,
    confidenceLabel: index === 0 ? '가장 유력' : '후보',
    countLabel:
      [publisher, publishedAt].filter(Boolean).join(' · ') ||
      `Aladin ID ${externalId}`,
    description: normalizeWhitespace(readString(item.description)),
    externalId,
    externalRefs: [],
    formatLabel: getFormatLabel(type),
    genresText: toGenresText(categoryName),
    id: `${ALADIN_PROVIDER}:${externalId}`,
    note: ALADIN_ATTRIBUTION,
    provider: ALADIN_PROVIDER,
    releaseCandidates: buildBookReleaseCandidates({
      externalId,
      isbn: readString(item.isbn13) || readString(item.isbn),
      provider: ALADIN_PROVIDER,
      releaseDate: publishedAt,
      thumbnailUrl,
      title,
      url: sourceUrl,
    }),
    reason: '제목/도서 카테고리 일치',
    releaseYear: parseYear(publishedAt),
    sourceLabel: 'Aladin Book',
    sourceUrl,
    thumbnailUrl,
    title,
    type,
  });
}

export function mapAniListItem(
  item: unknown,
  index: number,
  mediaType: string,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const titleObject = isRecord(item.title) ? item.title : {};
  const title =
    readString(titleObject.english) ||
    readString(titleObject.romaji) ||
    readString(titleObject.native);
  const titleAliases = [
    readString(titleObject.english),
    readString(titleObject.romaji),
    readString(titleObject.native),
  ].filter(Boolean);

  if (!title) {
    return null;
  }

  const format = readString(item.format);
  const type =
    mediaType === 'ANIME'
      ? WorkType.anime
      : format === 'NOVEL'
        ? WorkType.light_novel
        : WorkType.manga;
  const studios = readPathArray(item, ['studios', 'nodes'])
    .map((studio) => (isRecord(studio) ? readString(studio.name) : ''))
    .filter(Boolean);
  const staff = readPathArray(item, ['staff', 'nodes'])
    .map((person) =>
      isRecord(person) && isRecord(person.name)
        ? readString(person.name.full)
        : '',
    )
    .filter(Boolean);
  const contributors = [...studios, ...staff].slice(0, 4);

  return buildImportCandidate({
    author: contributors.join(', '),
    confidence: index === 0 ? 0.82 : 0.64,
    confidenceLabel: index === 0 ? 'AniList 상위' : 'AniList 후보',
    countLabel: format || 'AniList media',
    description: normalizeWhitespace(readString(item.description)),
    externalId: readString(item.id),
    formatLabel: getFormatLabel(type),
    id: `${ANILIST_PROVIDER}:${readString(item.id)}`,
    note: 'AniList GraphQL public API',
    provider: ANILIST_PROVIDER,
    reason: 'AniList 제목 검색 결과',
    releaseYear: readPathNumber(item, ['startDate', 'year']),
    sourceLabel: 'AniList',
    sourceUrl: `https://anilist.co/${mediaType === 'ANIME' ? 'anime' : 'manga'}/${readString(item.id)}`,
    subType: format ? format.toLowerCase() : null,
    thumbnailUrl: isRecord(item.coverImage)
      ? readString(item.coverImage.large)
      : '',
    title,
    titleAliases,
    type,
  });
}

export function mapGoogleBookItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const volumeInfo = isRecord(item.volumeInfo) ? item.volumeInfo : {};
  const title = readString(volumeInfo.title);

  if (!title) {
    return null;
  }

  const categories = readStringArray(volumeInfo.categories).join(', ');
  const type = mapBookWorkType(categories, title);
  const imageLinks = isRecord(volumeInfo.imageLinks)
    ? volumeInfo.imageLinks
    : {};
  const sourceUrl = readString(volumeInfo.infoLink);
  const thumbnailUrl =
    readString(imageLinks.thumbnail) ||
    readString(imageLinks.smallThumbnail);
  const subtitle = readString(volumeInfo.subtitle);

  return buildImportCandidate({
    author: readStringArray(volumeInfo.authors).join(', '),
    confidence: index === 0 ? 0.74 : 0.58,
    confidenceLabel: index === 0 ? 'Google 상위' : 'Google 후보',
    countLabel:
      [readString(volumeInfo.publisher), readString(volumeInfo.publishedDate)]
        .filter(Boolean)
        .join(' · ') || 'Google Books',
    description: normalizeWhitespace(readString(volumeInfo.description)),
    externalId: readString(item.id),
    externalRefs: [],
    formatLabel: getFormatLabel(type),
    genresText: categories,
    id: `${GOOGLE_BOOKS_PROVIDER}:${readString(item.id)}`,
    note: 'Google Books Volumes API',
    provider: GOOGLE_BOOKS_PROVIDER,
    releaseCandidates: buildBookReleaseCandidates({
      externalId: readString(item.id),
      isbn: readGoogleBooksIsbn(volumeInfo.industryIdentifiers),
      provider: GOOGLE_BOOKS_PROVIDER,
      releaseDate: readString(volumeInfo.publishedDate),
      thumbnailUrl,
      title,
      url: sourceUrl,
    }),
    reason: 'Google Books 제목 검색 결과',
    releaseYear: parseYear(readString(volumeInfo.publishedDate)),
    sourceLabel: 'Google Books',
    sourceUrl,
    thumbnailUrl,
    title,
    titleAliases: [
      title,
      subtitle,
      title && subtitle ? `${title}: ${subtitle}` : '',
    ].filter(Boolean),
    type,
  });
}

export function mapOpenLibraryItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readString(item.title);

  if (!title) {
    return null;
  }

  const key = readString(item.key);
  const sourceUrl = key ? `https://openlibrary.org${key}` : '';
  const thumbnailUrl = readOpenLibraryThumbnailUrl(item);
  const titleAliases = [
    title,
    ...readStringArray(item.alternative_title),
    ...readStringArray(item.title_suggest),
    readString(item.title_suggest),
  ].filter(Boolean);

  return buildImportCandidate({
    author: readStringArray(item.author_name).slice(0, 3).join(', '),
    confidence: index === 0 ? 0.68 : 0.5,
    confidenceLabel: index === 0 ? 'Open Library 상위' : 'Open Library 후보',
    countLabel: readNumber(item.first_publish_year)
      ? `${readNumber(item.first_publish_year)}`
      : 'Open Library',
    externalId: key || title,
    formatLabel: '소설/도서',
    id: `${OPEN_LIBRARY_PROVIDER}:${key || title}`,
    note: 'Open Library Search API',
    provider: OPEN_LIBRARY_PROVIDER,
    releaseCandidates: buildBookReleaseCandidates({
      externalId: key || title,
      isbn: readOpenLibraryIsbn(item.isbn),
      provider: OPEN_LIBRARY_PROVIDER,
      releaseDate: readNumber(item.first_publish_year)?.toString() ?? null,
      thumbnailUrl,
      title,
      url: sourceUrl,
    }),
    reason: 'Open Library 제목 검색 결과',
    releaseYear: readNumber(item.first_publish_year),
    sourceLabel: 'Open Library',
    sourceUrl,
    thumbnailUrl,
    title,
    titleAliases,
    type: WorkType.novel,
  });
}

export function mapTvMazeItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item) || !isRecord(item.show)) {
    return null;
  }

  const show = item.show;
  const title = readString(show.name);

  if (!title) {
    return null;
  }

  const image = isRecord(show.image) ? show.image : {};

  return buildImportCandidate({
    confidence: index === 0 ? 0.7 : 0.52,
    confidenceLabel: index === 0 ? 'TVmaze 상위' : 'TVmaze 후보',
    countLabel: readString(show.premiered) || 'TV series',
    description: normalizeWhitespace(stripHtml(readString(show.summary))),
    externalId: readString(show.id),
    formatLabel: '드라마/TV',
    genresText: readStringArray(show.genres).join(', '),
    id: `${TVMAZE_PROVIDER}:${readString(show.id)}`,
    note: 'TVmaze public API',
    provider: TVMAZE_PROVIDER,
    reason: 'TVmaze 쇼 검색 결과',
    releaseYear: parseYear(readString(show.premiered)),
    sourceLabel: 'TVmaze',
    sourceUrl: readString(show.url),
    thumbnailUrl: readString(image.medium) || readString(image.original),
    title,
    type: WorkType.drama,
  });
}

export function mapTmdbItem(
  item: unknown,
  index: number,
  rawType: 'movie' | 'tv',
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title =
    rawType === 'movie' ? readString(item.title) : readString(item.name);
  const originalTitle =
    rawType === 'movie'
      ? readString(item.original_title)
      : readString(item.original_name);

  if (!title) {
    return null;
  }

  const date =
    rawType === 'movie'
      ? readString(item.release_date)
      : readString(item.first_air_date);
  const posterPath = readString(item.poster_path);
  const type = rawType === 'movie' ? WorkType.movie : WorkType.drama;

  return buildImportCandidate({
    confidence: index === 0 ? 0.78 : 0.58,
    confidenceLabel: index === 0 ? 'TMDB 상위' : 'TMDB 후보',
    countLabel: date || 'TMDB',
    description: normalizeWhitespace(readString(item.overview)),
    externalId: readString(item.id),
    formatLabel: getFormatLabel(type),
    id: `${TMDB_PROVIDER}:${rawType}:${readString(item.id)}`,
    note: 'TMDB API',
    provider: TMDB_PROVIDER,
    reason: 'TMDB 제목 검색 결과',
    rawType,
    releaseYear: parseYear(date),
    sourceLabel: 'TMDB',
    sourceUrl: `https://www.themoviedb.org/${rawType}/${readString(item.id)}`,
    thumbnailUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : '',
    title,
    titleAliases: [title, originalTitle].filter(Boolean),
    type,
  });
}

export function mapNaverBookItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = stripHtml(readString(item.title));

  if (!title) {
    return null;
  }

  const type = mapBookWorkType('', title);
  const externalId = readString(item.isbn) || readString(item.link) || title;

  return buildImportCandidate({
    author: stripHtml(readString(item.author)),
    confidence: index === 0 ? 0.72 : 0.54,
    confidenceLabel: index === 0 ? 'Naver 상위' : 'Naver 후보',
    countLabel:
      [stripHtml(readString(item.publisher)), readString(item.pubdate)]
        .filter(Boolean)
        .join(' · ') || 'Naver Book',
    description: normalizeWhitespace(stripHtml(readString(item.description))),
    externalId,
    externalRefs: [],
    formatLabel: getFormatLabel(type),
    id: `${NAVER_BOOK_PROVIDER}:${externalId}`,
    note: 'Naver Search Book API',
    provider: NAVER_BOOK_PROVIDER,
    releaseCandidates: buildBookReleaseCandidates({
      externalId,
      isbn: readString(item.isbn),
      provider: NAVER_BOOK_PROVIDER,
      releaseDate: readString(item.pubdate),
      thumbnailUrl: readString(item.image),
      title,
      url: readString(item.link),
    }),
    reason: 'Naver 도서 검색 결과',
    releaseYear: parseYear(readString(item.pubdate)),
    sourceLabel: 'Naver Book',
    sourceUrl: readString(item.link),
    thumbnailUrl: readString(item.image),
    title,
    type,
  });
}

export function mapKakaoBookItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readString(item.title);

  if (!title) {
    return null;
  }

  const type = mapBookWorkType('', title);
  const externalId = readString(item.isbn) || readString(item.url) || title;

  return buildImportCandidate({
    author: readStringArray(item.authors).join(', '),
    confidence: index === 0 ? 0.72 : 0.54,
    confidenceLabel: index === 0 ? 'Kakao 상위' : 'Kakao 후보',
    countLabel:
      [readString(item.publisher), readString(item.datetime).slice(0, 10)]
        .filter(Boolean)
        .join(' · ') || 'Kakao Book',
    description: normalizeWhitespace(readString(item.contents)),
    externalId,
    externalRefs: [],
    formatLabel: getFormatLabel(type),
    id: `${KAKAO_BOOK_PROVIDER}:${externalId}`,
    note: 'Kakao Daum Book Search API',
    provider: KAKAO_BOOK_PROVIDER,
    releaseCandidates: buildBookReleaseCandidates({
      externalId,
      isbn: readString(item.isbn),
      provider: KAKAO_BOOK_PROVIDER,
      releaseDate: readString(item.datetime),
      thumbnailUrl: readString(item.thumbnail),
      title,
      url: readString(item.url),
    }),
    reason: 'Kakao 도서 검색 결과',
    releaseYear: parseYear(readString(item.datetime)),
    sourceLabel: 'Kakao Book',
    sourceUrl: readString(item.url),
    thumbnailUrl: readString(item.thumbnail),
    title,
    type,
  });
}

export function mapBraveSearchItem(
  item: unknown,
  index: number,
  requestedMediumType?: WorkType,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  return buildExternalWebSearchCandidate({
    confidence: index === 0 ? 0.78 : 0.6,
    description: readString(item.description),
    idPrefix: BRAVE_SEARCH_PROVIDER,
    note: 'Brave Search API',
    provider: BRAVE_SEARCH_PROVIDER,
    reason: 'Brave 웹 검색 결과',
    requestedMediumType,
    sourceLabel: 'Brave Search',
    title: readString(item.title),
    url: readString(item.url),
  });
}

export function mapTavilySearchItem(
  item: unknown,
  index: number,
  requestedMediumType?: WorkType,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  return buildExternalWebSearchCandidate({
    confidence: index === 0 ? 0.76 : 0.58,
    description: readString(item.content),
    idPrefix: TAVILY_SEARCH_PROVIDER,
    note: 'Tavily Search API',
    provider: TAVILY_SEARCH_PROVIDER,
    reason: 'Tavily 웹 검색 결과',
    requestedMediumType,
    sourceLabel: 'Tavily Search',
    title: readString(item.title),
    url: readString(item.url),
  });
}

export function mapNaverWebItem(
  item: unknown,
  index: number,
  requestedMediumType?: WorkType,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const rawTitle = stripHtml(readString(item.title));
  const title = normalizeWebSearchTitle(rawTitle);
  const sourceUrl = readString(item.link);
  const description = normalizeWhitespace(stripHtml(readString(item.description)));
  const type = inferWebSearchWorkType({
    description,
    requestedMediumType,
    title,
    url: sourceUrl,
  });

  if (!title || !type) {
    return null;
  }

  const externalId = sourceUrl || title;

  return buildImportCandidate({
    confidence: index === 0 ? 0.76 : 0.58,
    confidenceLabel: index === 0 ? 'Naver Web 상위' : 'Naver Web 후보',
    countLabel: getWebSourceLabel(sourceUrl) || 'Naver Web',
    description,
    externalId,
    formatLabel: getFormatLabel(type),
    id: `${NAVER_WEB_PROVIDER}:${externalId}`,
    note: 'Naver Search Web API',
    provider: NAVER_WEB_PROVIDER,
    reason: 'Naver 웹문서 검색 결과',
    sourceLabel: 'Naver Web',
    sourceUrl,
    title,
    titleAliases: [rawTitle, title].filter(Boolean),
    type,
  });
}

export function mapKakaoWebItem(
  item: unknown,
  index: number,
  requestedMediumType?: WorkType,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const rawTitle = stripHtml(readString(item.title));
  const title = normalizeWebSearchTitle(rawTitle);
  const sourceUrl = readString(item.url);
  const description = normalizeWhitespace(stripHtml(readString(item.contents)));
  const type = inferWebSearchWorkType({
    description,
    requestedMediumType,
    title,
    url: sourceUrl,
  });

  if (!title || !type) {
    return null;
  }

  const externalId = sourceUrl || title;

  return buildImportCandidate({
    confidence: index === 0 ? 0.76 : 0.58,
    confidenceLabel: index === 0 ? 'Kakao Web 상위' : 'Kakao Web 후보',
    countLabel:
      [getWebSourceLabel(sourceUrl), readString(item.datetime).slice(0, 10)]
        .filter(Boolean)
        .join(' · ') || 'Kakao Web',
    description,
    externalId,
    formatLabel: getFormatLabel(type),
    id: `${KAKAO_WEB_PROVIDER}:${externalId}`,
    note: 'Kakao Daum Web Search API',
    provider: KAKAO_WEB_PROVIDER,
    reason: 'Kakao 웹문서 검색 결과',
    releaseYear: parseYear(readString(item.datetime)),
    sourceLabel: 'Kakao Web',
    sourceUrl,
    title,
    titleAliases: [rawTitle, title].filter(Boolean),
    type,
  });
}

export function mapKobisMovieItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readString(item.movieNm);

  if (!title) {
    return null;
  }

  return buildImportCandidate({
    author: readString(item.directors),
    confidence: index === 0 ? 0.75 : 0.55,
    confidenceLabel: index === 0 ? 'KOBIS 상위' : 'KOBIS 후보',
    countLabel:
      [readString(item.openDt), readString(item.repNationNm)]
        .filter(Boolean)
        .join(' · ') || 'KOBIS movie',
    externalId: readString(item.movieCd) || title,
    formatLabel: '영화',
    id: `${KOBIS_PROVIDER}:${readString(item.movieCd) || title}`,
    note: 'KOBIS Open API',
    provider: KOBIS_PROVIDER,
    reason: 'KOBIS 영화명 검색 결과',
    releaseYear: parseYear(readString(item.prdtYear) || readString(item.openDt)),
    sourceLabel: 'KOBIS',
    title,
    type: WorkType.movie,
  });
}

export function readGoogleBooksIsbn(value: unknown) {
  const identifiers = Array.isArray(value) ? value : [];
  const isbn13 = identifiers.find((entry) => {
    return (
      isRecord(entry) && readString(entry.type).toUpperCase() === 'ISBN_13'
    );
  });

  if (isRecord(isbn13)) {
    return extractPrimaryIsbn(readString(isbn13.identifier));
  }

  const isbn10 = identifiers.find((entry) => {
    return (
      isRecord(entry) && readString(entry.type).toUpperCase() === 'ISBN_10'
    );
  });

  if (isRecord(isbn10)) {
    return extractPrimaryIsbn(readString(isbn10.identifier));
  }

  const fallback = identifiers.find((entry) => isRecord(entry));

  return isRecord(fallback)
    ? extractPrimaryIsbn(readString(fallback.identifier))
    : null;
}

export function readOpenLibraryIsbn(value: unknown) {
  const isbns = readStringArray(value);

  for (const isbn of isbns) {
    const normalized = extractPrimaryIsbn(isbn);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function readOpenLibraryThumbnailUrl(item: Record<string, unknown>) {
  const coverId = readNumber(item.cover_i);

  if (coverId !== null) {
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  }

  const editionKey =
    readString(item.cover_edition_key) ||
    readStringArray(item.cover_edition_key)[0];

  if (editionKey) {
    return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(editionKey)}-L.jpg`;
  }

  const isbn = readOpenLibraryIsbn(item.isbn);

  return isbn ? `https://covers.openlibrary.org/isbn/${isbn}-L.jpg` : '';
}

export function parseYear(value: string) {
  return parseNormalizedReleaseYear(value);
}

export function readString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return '';
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];
}

export function readPathArray(value: unknown, path: string[]) {
  const resolved = readPath(value, path);

  return Array.isArray(resolved) ? resolved : [];
}

export function readPathNumber(value: unknown, path: string[]) {
  return readNumber(readPath(value, path));
}

export function readPath(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    return isRecord(current) ? current[key] : undefined;
  }, value);
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function extractPrimaryIsbn(value: string | null) {
  return normalizeIsbn(readString(value));
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
