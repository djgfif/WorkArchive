import {
  BadGatewayException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  ALADIN_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  NAVER_BOOK_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../imports.constants';
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  mapAladinItem,
  mapGoogleBookItem,
  mapKakaoBookItem,
  mapNaverBookItem,
  mapOpenLibraryItem,
} from './import-candidate-book-mappers';
import {
  isRecord,
  readPathArray,
} from './import-candidate-readers';
import {
  ALADIN_ITEM_SEARCH_URL,
  GOOGLE_BOOKS_SEARCH_URL,
  KAKAO_BOOK_SEARCH_URL,
  NAVER_BOOK_SEARCH_URL,
  OPEN_LIBRARY_SEARCH_URL,
  PROVIDER_CACHE_TTL_MS,
} from './import-provider-config';
import { getImportProviderCacheKey } from './import-provider-http';
import { importCandidateMatchesMedium } from './import-provider-selection';
import type { ImportProviderSearchRuntime } from './import-provider-search-runtime';

export async function searchAladin(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  if (!userId) {
    throw new UnauthorizedException(
      'Aladin search requires a signed-in account.',
    );
  }

  const credentials = await runtime.getProviderCredentialValues(
    userId,
    ALADIN_PROVIDER,
  );
  const ttbKey = credentials?.ttbKey;

  if (!ttbKey) {
    throw new ForbiddenException(
      'Aladin API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(ALADIN_ITEM_SEARCH_URL);

  searchUrl.searchParams.set('ttbkey', ttbKey);
  searchUrl.searchParams.set('Query', query);
  searchUrl.searchParams.set('QueryType', 'Keyword');
  searchUrl.searchParams.set('SearchTarget', 'Book');
  searchUrl.searchParams.set('output', 'JS');
  searchUrl.searchParams.set('Version', '20131101');
  searchUrl.searchParams.set('MaxResults', limit.toString());
  searchUrl.searchParams.set('start', '1');
  searchUrl.searchParams.set('Cover', 'Big');

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
  });

  if (!isRecord(responseBody)) {
    throw new BadGatewayException(
      'Aladin search returned an invalid response.',
    );
  }

  if (responseBody.errorCode || responseBody.errorMessage) {
    throw new ForbiddenException('Configured Aladin API key was rejected.');
  }

  const items = responseBody.item;

  if (items === undefined) {
    return [];
  }

  if (!Array.isArray(items)) {
    throw new BadGatewayException(
      'Aladin search returned an invalid item list.',
    );
  }

  return items
    .map((item, index) => mapAladinItem(item, index))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

export async function searchGoogleBooks(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const searchUrl = new URL(GOOGLE_BOOKS_SEARCH_URL);

  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('maxResults', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: GOOGLE_BOOKS_PROVIDER,
      query,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });
  const items = readPathArray(responseBody, ['items']);

  return items
    .map((item, index) => mapGoogleBookItem(item, index))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return (
        candidate !== null && importCandidateMatchesMedium(candidate, mediumType)
      );
    });
}

export async function searchOpenLibrary(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const searchUrl = new URL(OPEN_LIBRARY_SEARCH_URL);

  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('limit', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: OPEN_LIBRARY_PROVIDER,
      query,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });
  const docs = readPathArray(responseBody, ['docs']);

  return docs
    .map((item, index) => mapOpenLibraryItem(item, index))
    .filter(
      (candidate): candidate is ImportCandidateResponseDto => candidate !== null,
    );
}

export async function searchNaverBook(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValues(userId, NAVER_BOOK_PROVIDER)
    : null;
  const clientId = credential?.clientId;
  const clientSecret = credential?.clientSecret;

  if (!clientId || !clientSecret) {
    throw new ForbiddenException(
      'Naver Book API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(NAVER_BOOK_SEARCH_URL);

  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('display', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: NAVER_BOOK_PROVIDER,
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
    .map((item, index) => mapNaverBookItem(item, index))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return (
        candidate !== null && importCandidateMatchesMedium(candidate, mediumType)
      );
    });
}

export async function searchKakaoBook(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValues(userId, KAKAO_BOOK_PROVIDER)
    : null;
  const restApiKey = credential?.restApiKey;

  if (!restApiKey) {
    throw new ForbiddenException(
      'Kakao Book API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(KAKAO_BOOK_SEARCH_URL);

  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('size', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    bearerPrefix: 'KakaoAK',
    bearerToken: restApiKey,
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: KAKAO_BOOK_PROVIDER,
      query,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });
  const documents = readPathArray(responseBody, ['documents']);

  return documents
    .map((item, index) => mapKakaoBookItem(item, index))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return (
        candidate !== null && importCandidateMatchesMedium(candidate, mediumType)
      );
    });
}
