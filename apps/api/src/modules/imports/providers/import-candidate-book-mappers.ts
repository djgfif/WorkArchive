import { WorkType } from '@prisma/client';

import { normalizeIsbn } from '../candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  ALADIN_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  NAVER_BOOK_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../imports.constants';
import {
  buildBookReleaseCandidates,
  buildImportCandidate,
  getFormatLabel,
  mapBookWorkType,
  normalizeWhitespace,
  parseYear,
  stripHtml,
  toGenresText,
} from './import-candidate-builder';
import { ALADIN_ATTRIBUTION } from './import-provider-config';
import {
  isRecord,
  readNumber,
  readString,
  readStringArray,
} from './import-candidate-readers';

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

function extractPrimaryIsbn(value: string | null) {
  return normalizeIsbn(readString(value));
}
