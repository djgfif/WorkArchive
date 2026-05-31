import {
  BadGatewayException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';

import { normalizeImportTitleSignal } from '../candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  ALADIN_PROVIDER,
  ANILIST_PROVIDER,
  BRAVE_SEARCH_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
  WIKIDATA_PROVIDER,
  type ImportProvider,
} from '../imports.constants';
import {
  buildGeneralWebSearchQuery,
  buildImportCandidate,
  getFormatLabel,
  isRecord,
  mapAladinItem,
  mapAniListItem,
  mapBraveSearchItem,
  mapGoogleBookItem,
  mapKakaoBookItem,
  mapKakaoWebItem,
  mapKobisMovieItem,
  mapNaverBookItem,
  mapNaverWebItem,
  mapOpenLibraryItem,
  mapTavilySearchItem,
  mapTmdbItem,
  mapTvMazeItem,
  normalizeProviderSearchQuery,
  readPath,
  readPathArray,
  readString,
  type UnknownRecord,
} from './import-candidate-builder';
import {
  ALADIN_ITEM_SEARCH_URL,
  ANILIST_GRAPHQL_URL,
  BRAVE_SEARCH_URL,
  GOOGLE_BOOKS_SEARCH_URL,
  KAKAO_BOOK_SEARCH_URL,
  KAKAO_WEB_SEARCH_URL,
  KOBIS_MOVIE_SEARCH_URL,
  NAVER_BOOK_SEARCH_URL,
  NAVER_WEB_SEARCH_URL,
  OPEN_LIBRARY_SEARCH_URL,
  PROVIDER_CACHE_TTL_MS,
  TAVILY_SEARCH_URL,
  TMDB_SEARCH_MOVIE_URL,
  TMDB_SEARCH_TV_URL,
  TVMAZE_SEARCH_URL,
  WEB_SERIAL_INCLUDE_DOMAINS,
  WIKIDATA_API_URL,
} from './import-provider-config';
import type {
  ProviderCredentialValues,
  ProviderSearchContext,
} from './import-provider-adapter';
import {
  getImportProviderCacheKey,
  type ImportProviderFetchOptions,
} from './import-provider-http';
import { importCandidateMatchesMedium } from './import-provider-selection';
import {
  getWikidataHeaders,
  getWikidataSearchLanguage,
  mapWikidataEntity,
  readWikidataRelatedEntityIds,
} from './wikidata-candidate-mapper';

export interface ImportProviderSearchRuntime {
  fetchJson(
    rawUrl: URL | string,
    options: ImportProviderFetchOptions,
  ): Promise<unknown>;
  getProviderCredentialValues(
    userId: string,
    provider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
  getProviderCredentialValuesWithFallback(
    userId: string,
    provider: ImportProvider,
    fallbackProvider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
}

export async function searchImportProviderWithFallback(
  provider: ImportProvider,
  context: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
) {
  const variants =
    provider === MANUAL_PROVIDER
      ? [context.query]
      : getProviderSearchQueryVariants(context.query);
  const candidates: ImportCandidateResponseDto[] = [];

  for (const [index, query] of variants.entries()) {
    try {
      const providerCandidates = await searchImportProvider(
        provider,
        {
          ...context,
          query,
        },
        runtime,
      );

      candidates.push(...providerCandidates);

      if (
        index === 0 &&
        !shouldTrySearchFallback(providerCandidates, context.query)
      ) {
        return providerCandidates;
      }

      if (index > 0 && providerCandidates.length > 0) {
        break;
      }
    } catch (error) {
      if (index === 0 || candidates.length === 0) {
        throw error;
      }

      break;
    }
  }

  return candidates;
}

async function searchImportProvider(
  provider: ImportProvider,
  context: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
) {
  switch (provider) {
    case ALADIN_PROVIDER:
      return searchAladin(context, runtime);
    case ANILIST_PROVIDER:
      return searchAniList(context, runtime);
    case GOOGLE_BOOKS_PROVIDER:
      return searchGoogleBooks(context, runtime);
    case OPEN_LIBRARY_PROVIDER:
      return searchOpenLibrary(context, runtime);
    case TVMAZE_PROVIDER:
      return searchTvMaze(context, runtime);
    case TMDB_PROVIDER:
      return searchTmdb(context, runtime);
    case NAVER_BOOK_PROVIDER:
      return searchNaverBook(context, runtime);
    case KAKAO_BOOK_PROVIDER:
      return searchKakaoBook(context, runtime);
    case BRAVE_SEARCH_PROVIDER:
      return searchBrave(context, runtime);
    case TAVILY_SEARCH_PROVIDER:
      return searchTavily(context, runtime);
    case NAVER_WEB_PROVIDER:
      return searchNaverWeb(context, runtime);
    case KAKAO_WEB_PROVIDER:
      return searchKakaoWeb(context, runtime);
    case KOBIS_PROVIDER:
      return searchKobis(context, runtime);
    case WIKIDATA_PROVIDER:
      return searchWikidata(context, runtime);
    case MANUAL_PROVIDER:
      return searchManual(context);
  }
}

function getProviderSearchQueryVariants(query: string) {
  const normalized = normalizeProviderSearchQuery(query);
  const withoutBracketSuffix = normalizeProviderSearchQuery(
    normalized.replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, ''),
  );
  const withoutVolumeSuffix = normalizeProviderSearchQuery(
    withoutBracketSuffix.replace(
      /\s*(?:(?:vol(?:ume)?\.?|book|시즌|season)\s*\d+|\d+\s*(?:권|화|회|장|부))\s*$/iu,
      '',
    ),
  );
  const withoutNumericSuffix = normalizeProviderSearchQuery(
    withoutVolumeSuffix.replace(/\s+\d+\s*$/u, ''),
  );

  return Array.from(
    new Set(
      [
        normalized,
        withoutBracketSuffix,
        withoutVolumeSuffix,
        withoutNumericSuffix,
      ].filter(Boolean),
    ),
  );
}

function shouldTrySearchFallback(
  candidates: ImportCandidateResponseDto[],
  query: string,
) {
  return (
    candidates.length === 0 ||
    !candidates.some((candidate) => hasStrongTitleSignal(candidate, query))
  );
}

function hasStrongTitleSignal(
  candidate: ImportCandidateResponseDto,
  query: string,
) {
  const normalizedQuery = normalizeImportTitleSignal(query);

  if (!normalizedQuery) {
    return false;
  }

  return [candidate.title, ...(candidate.titleAliases ?? [])]
    .map(normalizeImportTitleSignal)
    .some((titleSignal) => {
      return (
        titleSignal === normalizedQuery ||
        titleSignal.includes(normalizedQuery) ||
        normalizedQuery.includes(titleSignal)
      );
    });
}

async function searchAladin(
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

async function searchAniList(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const requestedTypes =
    mediumType === WorkType.anime
      ? ['ANIME']
      : mediumType === WorkType.manga ||
          mediumType === WorkType.light_novel ||
          mediumType === WorkType.web_novel
        ? ['MANGA']
        : ['ANIME', 'MANGA'];
  const results: ImportCandidateResponseDto[] = [];

  for (const mediaType of requestedTypes) {
    const body = {
      query: `
          query ($search: String, $perPage: Int, $type: MediaType) {
            Page(page: 1, perPage: $perPage) {
              media(search: $search, type: $type) {
                id
                title { romaji english native }
                format
                startDate { year }
                description(asHtml: false)
                coverImage { large }
                studios(isMain: true) { nodes { name } }
                staff(perPage: 3) { nodes { name { full } primaryOccupations } }
              }
            }
          }
        `,
      variables: {
        perPage: Math.min(limit, 10),
        search: query,
        type: mediaType,
      },
    };
    const responseBody = await runtime.fetchJson(ANILIST_GRAPHQL_URL, {
      accept: 'application/json',
      body: JSON.stringify(body),
      cacheKey: getImportProviderCacheKey({
        limit,
        mediumType,
        provider: ANILIST_PROVIDER,
        query,
        variant: mediaType,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
      contentType: 'application/json',
      method: 'POST',
    });
    const media = readPathArray(responseBody, ['data', 'Page', 'media']);

    results.push(
      ...media
        .map((item, index) => mapAniListItem(item, index, mediaType))
        .filter((candidate): candidate is ImportCandidateResponseDto => {
          return (
            candidate !== null && (!mediumType || candidate.mediumType === mediumType)
          );
        }),
    );
  }

  return results;
}

async function searchGoogleBooks(
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

async function searchOpenLibrary(
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

async function searchTvMaze(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const searchUrl = new URL(TVMAZE_SEARCH_URL);

  searchUrl.searchParams.set('q', query);

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: TVMAZE_PROVIDER,
      query,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });

  if (!Array.isArray(responseBody)) {
    return [];
  }

  return responseBody
    .slice(0, limit)
    .map((item, index) => mapTvMazeItem(item, index))
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

async function searchTmdb(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValues(userId, TMDB_PROVIDER)
    : null;
  const readToken = credential?.readToken;

  if (!readToken) {
    throw new ForbiddenException(
      'TMDB API key is not configured for this user.',
    );
  }

  const urls: Array<{ rawType: 'movie' | 'tv'; url: URL }> = [];

  if (!mediumType || mediumType === WorkType.movie) {
    urls.push({
      rawType: 'movie',
      url: new URL(TMDB_SEARCH_MOVIE_URL),
    });
  }

  if (!mediumType || mediumType === WorkType.drama) {
    urls.push({
      rawType: 'tv',
      url: new URL(TMDB_SEARCH_TV_URL),
    });
  }

  const candidates: ImportCandidateResponseDto[] = [];

  for (const { rawType, url } of urls) {
    url.searchParams.set('query', query);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'ko-KR');

    const fetchOptions: ImportProviderFetchOptions = {
      accept: 'application/json',
      cacheKey: getImportProviderCacheKey({
        limit,
        mediumType,
        provider: TMDB_PROVIDER,
        query,
        userScope: userId,
        variant: rawType,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    };

    fetchOptions.bearerToken = readToken;

    const responseBody = await runtime.fetchJson(url, fetchOptions);
    const results = readPathArray(responseBody, ['results']);

    candidates.push(
      ...results
        .slice(0, limit)
        .map((item, index) => mapTmdbItem(item, index, rawType))
        .filter(
          (candidate): candidate is ImportCandidateResponseDto =>
            candidate !== null,
        ),
    );
  }

  return candidates;
}

async function searchNaverBook(
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

async function searchKakaoBook(
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

async function searchBrave(
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

async function searchTavily(
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

async function searchNaverWeb(
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

async function searchKakaoWeb(
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

async function searchKobis(
  { limit, mediumType, query, userId }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const credential = userId
    ? await runtime.getProviderCredentialValues(userId, KOBIS_PROVIDER)
    : null;
  const apiKey = credential?.apiKey;

  if (!apiKey) {
    throw new ForbiddenException(
      'KOBIS API key is not configured for this user.',
    );
  }

  const searchUrl = new URL(KOBIS_MOVIE_SEARCH_URL);

  searchUrl.searchParams.set('key', apiKey);
  searchUrl.searchParams.set('movieNm', query);
  searchUrl.searchParams.set('itemPerPage', Math.min(limit, 20).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: KOBIS_PROVIDER,
      query,
      userScope: userId,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
  });
  const movies = readPathArray(responseBody, [
    'movieListResult',
    'movieList',
  ]);

  return movies
    .map((item, index) => mapKobisMovieItem(item, index))
    .filter(
      (candidate): candidate is ImportCandidateResponseDto => candidate !== null,
    );
}

async function searchWikidata(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const searchUrl = new URL(WIKIDATA_API_URL);
  const language = getWikidataSearchLanguage(query);

  searchUrl.searchParams.set('action', 'wbsearchentities');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('language', language);
  searchUrl.searchParams.set('uselang', language);
  searchUrl.searchParams.set('type', 'item');
  searchUrl.searchParams.set('search', query);
  searchUrl.searchParams.set('limit', Math.min(limit, 10).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: WIKIDATA_PROVIDER,
      query,
      variant: `search:${language}`,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: getWikidataHeaders(),
    retryAfterMaxMs: 1_000,
  });
  const qids = Array.from(
    new Set(
      readPathArray(responseBody, ['search'])
        .map((item) =>
          isRecord(item) ? readString(item.id) || readString(item.title) : '',
        )
        .filter((id) => /^Q\d+$/u.test(id)),
    ),
  ).slice(0, Math.min(limit, 10));

  if (qids.length === 0) {
    return [];
  }

  const entityMap = await fetchWikidataEntities(
    {
      ids: qids,
      limit,
      mediumType,
      query,
      variant: 'primary',
    },
    runtime,
  );
  const relatedIds = Array.from(
    new Set(
      [...entityMap.values()].flatMap((entity) =>
        readWikidataRelatedEntityIds(entity),
      ),
    ),
  ).slice(0, 50);
  const relatedEntityMap =
    relatedIds.length > 0
      ? await fetchWikidataEntities(
          {
            ids: relatedIds,
            limit,
            mediumType,
            query,
            variant: 'related',
          },
          runtime,
        )
      : new Map<string, UnknownRecord>();

  return qids
    .map((qid, index) =>
      mapWikidataEntity({
        entity: entityMap.get(qid),
        index,
        mediumType,
        query,
        relatedEntityMap,
      }),
    )
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

function searchManual({
  mediumType,
  query,
}: ProviderSearchContext): ImportCandidateResponseDto[] {
  const mediumTypes = mediumType
    ? [mediumType]
    : [
        WorkType.light_novel,
        WorkType.manga,
        WorkType.anime,
        WorkType.movie,
        WorkType.drama,
        WorkType.web_novel,
        WorkType.webtoon,
      ];

  return mediumTypes.map((type, index) =>
    buildImportCandidate({
      confidence: index === 0 ? 0.55 : 0.35,
      confidenceLabel: index === 0 ? '수동 후보' : '매체 후보',
      countLabel: '사용자 검토 필요',
      description:
        '공식 API 후보가 없거나 웹연재처럼 공개 메타데이터 API가 부족한 경우를 위한 수동 후보입니다. 스크래핑 없이 사용자가 직접 확인합니다.',
      externalId: `${query}:${type}`,
      externalRefs: [],
      formatLabel: getFormatLabel(type),
      id: `${MANUAL_PROVIDER}:${query}:${type}`,
      note: '공식 API/수동 입력만 사용하며 스크래핑하지 않습니다.',
      provider: MANUAL_PROVIDER,
      reason: '수동 입력 fallback',
      sourceLabel: 'Manual',
      title: type === mediumType ? query : `${query} (${getFormatLabel(type)})`,
      type,
    }),
  );
}

async function fetchWikidataEntities(
  input: {
    ids: string[];
    limit: number;
    mediumType: WorkType | undefined;
    query: string;
    variant: string;
  },
  runtime: ImportProviderSearchRuntime,
) {
  const ids = Array.from(new Set(input.ids.filter((id) => /^Q\d+$/u.test(id))));
  const entityMap = new Map<string, UnknownRecord>();

  if (ids.length === 0) {
    return entityMap;
  }

  const entityUrl = new URL(WIKIDATA_API_URL);

  entityUrl.searchParams.set('action', 'wbgetentities');
  entityUrl.searchParams.set('format', 'json');
  entityUrl.searchParams.set('ids', ids.slice(0, 50).join('|'));
  entityUrl.searchParams.set(
    'props',
    'labels|descriptions|aliases|claims|sitelinks/urls',
  );
  entityUrl.searchParams.set('languages', 'ko|en|ja|mul');
  entityUrl.searchParams.set('sitefilter', 'kowiki|enwiki|jawiki');

  const responseBody = await runtime.fetchJson(entityUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit: input.limit,
      mediumType: input.mediumType,
      provider: WIKIDATA_PROVIDER,
      query: input.query,
      variant: `entities:${input.variant}:${ids.join(',')}`,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: getWikidataHeaders(),
    retryAfterMaxMs: 1_000,
  });
  const entities = readPath(responseBody, ['entities']);

  if (!isRecord(entities)) {
    return entityMap;
  }

  for (const id of ids) {
    const entity = entities[id];

    if (isRecord(entity) && !entity.missing) {
      entityMap.set(id, entity);
    }
  }

  return entityMap;
}
