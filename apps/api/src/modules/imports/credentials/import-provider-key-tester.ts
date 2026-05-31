import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import {
  ALADIN_PROVIDER,
  BRAVE_SEARCH_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  TMDB_PROVIDER,
  type ImportProvider,
} from '../imports.constants';
import {
  ALADIN_ITEM_SEARCH_URL,
  BRAVE_SEARCH_URL,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  KAKAO_BOOK_SEARCH_URL,
  KAKAO_WEB_SEARCH_URL,
  KOBIS_MOVIE_SEARCH_URL,
  NAVER_BOOK_SEARCH_URL,
  NAVER_WEB_SEARCH_URL,
  TAVILY_SEARCH_URL,
  TMDB_SEARCH_MOVIE_URL,
  getKobisDisabledMessage,
  isKobisHttpProviderEnabled,
} from '../providers/import-provider-config';
import type { ProviderCredentialValues } from '../providers/import-provider-adapter';

export type ImportProviderFetchJson = (
  rawUrl: URL | string,
  options: {
    accept: string;
    bearerPrefix?: string;
    bearerToken?: string;
    body?: string;
    cacheKey?: string;
    cacheTtlMs?: number;
    contentType?: string;
    headers?: Record<string, string>;
    method?: string;
    queryApiKey?: string;
    retryAfterMaxMs?: number;
    timeoutMs?: number;
  },
) => Promise<unknown>;

export async function runImportProviderKeyTest(
  provider: ImportProvider,
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  switch (provider) {
    case ALADIN_PROVIDER:
      return testAladinProviderKey(credentials, fetchJson);
    case NAVER_BOOK_PROVIDER:
      return testNaverProviderKey(
        credentials,
        NAVER_BOOK_SEARCH_URL,
        fetchJson,
      );
    case NAVER_WEB_PROVIDER:
      return testNaverProviderKey(credentials, NAVER_WEB_SEARCH_URL, fetchJson);
    case KAKAO_BOOK_PROVIDER:
      return testKakaoProviderKey(
        credentials,
        KAKAO_BOOK_SEARCH_URL,
        fetchJson,
      );
    case KAKAO_WEB_PROVIDER:
      return testKakaoProviderKey(credentials, KAKAO_WEB_SEARCH_URL, fetchJson);
    case TMDB_PROVIDER:
      return testTmdbProviderKey(credentials, fetchJson);
    case BRAVE_SEARCH_PROVIDER:
      return testBraveProviderKey(credentials, fetchJson);
    case TAVILY_SEARCH_PROVIDER:
      return testTavilyProviderKey(credentials, fetchJson);
    case KOBIS_PROVIDER:
      if (!isKobisHttpProviderEnabled()) {
        throw new ForbiddenException(getKobisDisabledMessage());
      }

      return testKobisProviderKey(credentials, fetchJson);
    default:
      throw new BadRequestException('Unsupported provider key test.');
  }
}

async function testAladinProviderKey(
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  const ttbKey = credentials.ttbKey;

  if (!ttbKey) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(ALADIN_ITEM_SEARCH_URL);

  searchUrl.searchParams.set('ttbkey', ttbKey);
  searchUrl.searchParams.set('Query', '해리포터');
  searchUrl.searchParams.set('QueryType', 'Keyword');
  searchUrl.searchParams.set('SearchTarget', 'Book');
  searchUrl.searchParams.set('output', 'JS');
  searchUrl.searchParams.set('Version', '20131101');
  searchUrl.searchParams.set('MaxResults', '1');
  searchUrl.searchParams.set('start', '1');

  const responseBody = await fetchJson(searchUrl, {
    accept: 'application/json',
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });

  if (
    isPlainRecord(responseBody) &&
    (responseBody.errorCode || responseBody.errorMessage)
  ) {
    throw new ForbiddenException('Provider API key was rejected.');
  }
}

async function testNaverProviderKey(
  credentials: ProviderCredentialValues,
  rawUrl: string,
  fetchJson: ImportProviderFetchJson,
) {
  const clientId = credentials.clientId;
  const clientSecret = credentials.clientSecret;

  if (!clientId || !clientSecret) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(rawUrl);

  searchUrl.searchParams.set('query', '해리포터');
  searchUrl.searchParams.set('display', '1');

  await fetchJson(searchUrl, {
    accept: 'application/json',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

async function testKakaoProviderKey(
  credentials: ProviderCredentialValues,
  rawUrl: string,
  fetchJson: ImportProviderFetchJson,
) {
  const restApiKey = credentials.restApiKey;

  if (!restApiKey) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(rawUrl);

  searchUrl.searchParams.set('query', '해리포터');
  searchUrl.searchParams.set('size', '1');

  await fetchJson(searchUrl, {
    accept: 'application/json',
    bearerPrefix: 'KakaoAK',
    bearerToken: restApiKey,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

async function testTmdbProviderKey(
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  const readToken = credentials.readToken;

  if (!readToken) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(TMDB_SEARCH_MOVIE_URL);

  searchUrl.searchParams.set('query', 'inception');
  searchUrl.searchParams.set('include_adult', 'false');
  searchUrl.searchParams.set('language', 'ko-KR');

  await fetchJson(searchUrl, {
    accept: 'application/json',
    bearerToken: readToken,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

async function testKobisProviderKey(
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  const apiKey = credentials.apiKey;

  if (!apiKey) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(KOBIS_MOVIE_SEARCH_URL);

  searchUrl.searchParams.set('key', apiKey);
  searchUrl.searchParams.set('movieNm', 'inception');
  searchUrl.searchParams.set('itemPerPage', '1');

  await fetchJson(searchUrl, {
    accept: 'application/json',
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

async function testBraveProviderKey(
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  const apiKey = credentials.apiKey;

  if (!apiKey) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  const searchUrl = new URL(BRAVE_SEARCH_URL);

  searchUrl.searchParams.set('q', 'test');
  searchUrl.searchParams.set('count', '1');

  await fetchJson(searchUrl, {
    accept: 'application/json',
    headers: {
      'X-Subscription-Token': apiKey,
    },
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

async function testTavilyProviderKey(
  credentials: ProviderCredentialValues,
  fetchJson: ImportProviderFetchJson,
) {
  const apiKey = credentials.apiKey;

  if (!apiKey) {
    throw new ForbiddenException('Provider API key is missing.');
  }

  await fetchJson(TAVILY_SEARCH_URL, {
    accept: 'application/json',
    bearerToken: apiKey,
    body: JSON.stringify({
      include_raw_content: false,
      max_results: 1,
      query: 'test',
      search_depth: 'basic',
    }),
    contentType: 'application/json',
    method: 'POST',
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
