import { ForbiddenException } from '@nestjs/common';
import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  ANILIST_PROVIDER,
  KOBIS_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
} from '../imports.constants';
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  mapAniListItem,
  mapKobisMovieItem,
  mapTmdbItem,
  mapTvMazeItem,
  readPathArray,
} from './import-candidate-builder';
import {
  ANILIST_GRAPHQL_URL,
  KOBIS_MOVIE_SEARCH_URL,
  PROVIDER_CACHE_TTL_MS,
  TMDB_SEARCH_MOVIE_URL,
  TMDB_SEARCH_TV_URL,
  TVMAZE_SEARCH_URL,
} from './import-provider-config';
import {
  getImportProviderCacheKey,
  type ImportProviderFetchOptions,
} from './import-provider-http';
import type { ImportProviderSearchRuntime } from './import-provider-search-runtime';

export async function searchAniList(
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

export async function searchTvMaze(
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

export async function searchTmdb(
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

export async function searchKobis(
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
