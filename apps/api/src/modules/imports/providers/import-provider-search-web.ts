import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  BRAVE_SEARCH_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
} from '../imports.constants';
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  buildGeneralWebSearchQuery,
  mapBraveSearchItem,
  mapKakaoWebItem,
  mapNaverWebItem,
  mapTavilySearchItem,
  readPathArray,
} from './import-candidate-builder';
import {
  BRAVE_SEARCH_URL,
  KAKAO_WEB_SEARCH_URL,
  NAVER_WEB_SEARCH_URL,
  PROVIDER_CACHE_TTL_MS,
  TAVILY_SEARCH_URL,
  WEB_SERIAL_INCLUDE_DOMAINS,
} from './import-provider-config';
import { getImportProviderCacheKey } from './import-provider-http';
import type { ImportProviderSearchRuntime } from './import-provider-search-runtime';

export async function searchBrave(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  if (!userId) {
    throw new UnauthorizedException(
      'Brave Search requires a signed-in account.',
    );
  }

  const credentials = await runtime.getProviderCredentialValues(
    userId,
    BRAVE_SEARCH_PROVIDER,
  );
  const apiKey = credentials?.apiKey;

  if (!apiKey) {
    throw new ForbiddenException(
      'Brave Search API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(BRAVE_SEARCH_URL);
  const rewrittenQuery = buildGeneralWebSearchQuery(query, mediumType);

  searchUrl.searchParams.set('q', rewrittenQuery);
  searchUrl.searchParams.set('count', Math.min(limit, 20).toString());
  searchUrl.searchParams.set('country', 'kr');
  searchUrl.searchParams.set('search_lang', 'ko');

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: BRAVE_SEARCH_PROVIDER,
      query: rewrittenQuery,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: {
      'X-Subscription-Token': apiKey,
    },
  });
  const results = readPathArray(responseBody, ['web', 'results']);

  return results
    .map((item, index) => mapBraveSearchItem(item, index, mediumType))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

export async function searchTavily(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  if (!userId) {
    throw new UnauthorizedException(
      'Tavily Search requires a signed-in account.',
    );
  }

  const credentials = await runtime.getProviderCredentialValues(
    userId,
    TAVILY_SEARCH_PROVIDER,
  );
  const apiKey = credentials?.apiKey;

  if (!apiKey) {
    throw new ForbiddenException(
      'Tavily API key is not configured for this user.',
    );
  }

  const rewrittenQuery = buildGeneralWebSearchQuery(query, mediumType);
  const responseBody = await runtime.fetchJson(TAVILY_SEARCH_URL, {
    accept: 'application/json',
    bearerToken: apiKey,
    body: JSON.stringify({
      query: rewrittenQuery,
      country: 'south korea',
      include_domains: WEB_SERIAL_INCLUDE_DOMAINS,
      include_raw_content: false,
      max_results: Math.min(limit, 20),
      search_depth: 'basic',
      topic: 'general',
    }),
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: TAVILY_SEARCH_PROVIDER,
      query: rewrittenQuery,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    contentType: 'application/json',
    method: 'POST',
  });
  const results = readPathArray(responseBody, ['results']);

  return results
    .map((item, index) => mapTavilySearchItem(item, index, mediumType))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

export async function searchNaverWeb(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValuesWithFallback(
        userId,
        NAVER_WEB_PROVIDER,
        NAVER_BOOK_PROVIDER,
      )
    : null;
  const clientId = credential?.clientId;
  const clientSecret = credential?.clientSecret;

  if (!clientId || !clientSecret) {
    throw new ForbiddenException(
      'Naver Web API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(NAVER_WEB_SEARCH_URL);

  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('display', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: NAVER_WEB_PROVIDER,
      query,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });
  const items = readPathArray(responseBody, ['items']);

  return items
    .map((item, index) => mapNaverWebItem(item, index, mediumType))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

export async function searchKakaoWeb(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValuesWithFallback(
        userId,
        KAKAO_WEB_PROVIDER,
        KAKAO_BOOK_PROVIDER,
      )
    : null;
  const restApiKey = credential?.restApiKey;

  if (!restApiKey) {
    throw new ForbiddenException(
      'Kakao Web API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(KAKAO_WEB_SEARCH_URL);

  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('size', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    bearerPrefix: 'KakaoAK',
    bearerToken: restApiKey,
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: KAKAO_WEB_PROVIDER,
      query,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });
  const documents = readPathArray(responseBody, ['documents']);

  return documents
    .map((item, index) => mapKakaoWebItem(item, index, mediumType))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}
