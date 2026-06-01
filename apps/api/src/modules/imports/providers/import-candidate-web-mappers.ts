import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  BRAVE_SEARCH_PROVIDER,
  KAKAO_WEB_PROVIDER,
  NAVER_WEB_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  type ImportProvider,
} from '../imports.constants';
import {
  buildImportCandidate,
  getFormatLabel,
  normalizeProviderSearchQuery,
  normalizeWhitespace,
  parseYear,
  stripHtml,
} from './import-candidate-builder';
import { isRecord, readString } from './import-candidate-readers';

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
    isHostnameInDomain(hostname, 'ridibooks.com') ||
    isHostnameInDomain(hostname, 'munpia.com') ||
    isHostnameInDomain(hostname, 'novelpia.com') ||
    isHostnameInDomain(hostname, 'joara.com') ||
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

  if (isHostnameInDomain(hostname, 'ridibooks.com')) {
    return 'Ridi';
  }

  if (isHostnameInDomain(hostname, 'munpia.com')) {
    return 'Munpia';
  }

  if (isHostnameInDomain(hostname, 'novelpia.com')) {
    return 'Novelpia';
  }

  if (isHostnameInDomain(hostname, 'joara.com')) {
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

function isHostnameInDomain(hostname: string, domain: string) {
  const hostnameLabels = hostname.split('.');
  const domainLabels = domain.split('.');

  if (hostnameLabels.length < domainLabels.length) {
    return false;
  }

  const offset = hostnameLabels.length - domainLabels.length;

  return domainLabels.every(
    (label, index) => hostnameLabels[offset + index] === label,
  );
}
