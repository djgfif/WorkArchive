import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import type { ImportSearchQueryDto } from '../dto/import-search-query.dto';
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
import { DEFAULT_LIMIT, MAX_LIMIT } from './import-provider-config';
import { PROVIDERS } from './import-provider-adapter';

export function normalizeImportSearchLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

export function resolveImportProviders(
  searchQuery: ImportSearchQueryDto,
  mediumType?: WorkType,
): ImportProvider[] {
  if (searchQuery.providers && searchQuery.providers.length > 0) {
    return searchQuery.providers;
  }

  if (searchQuery.provider) {
    return [searchQuery.provider];
  }

  if (mediumType === WorkType.web_novel) {
    return [
      BRAVE_SEARCH_PROVIDER,
      KAKAO_WEB_PROVIDER,
      NAVER_WEB_PROVIDER,
      TAVILY_SEARCH_PROVIDER,
      KAKAO_BOOK_PROVIDER,
      NAVER_BOOK_PROVIDER,
      GOOGLE_BOOKS_PROVIDER,
      WIKIDATA_PROVIDER,
      MANUAL_PROVIDER,
    ];
  }

  if (mediumType === WorkType.webtoon) {
    return [
      BRAVE_SEARCH_PROVIDER,
      NAVER_WEB_PROVIDER,
      KAKAO_WEB_PROVIDER,
      TAVILY_SEARCH_PROVIDER,
      NAVER_BOOK_PROVIDER,
      KAKAO_BOOK_PROVIDER,
      GOOGLE_BOOKS_PROVIDER,
      WIKIDATA_PROVIDER,
      MANUAL_PROVIDER,
    ];
  }

  if (mediumType === WorkType.anime) {
    return [
      ANILIST_PROVIDER,
      BRAVE_SEARCH_PROVIDER,
      TVMAZE_PROVIDER,
      WIKIDATA_PROVIDER,
      MANUAL_PROVIDER,
    ];
  }

  if (mediumType === WorkType.movie) {
    return [TMDB_PROVIDER, KOBIS_PROVIDER, WIKIDATA_PROVIDER, MANUAL_PROVIDER];
  }

  if (mediumType === WorkType.drama) {
    return [TMDB_PROVIDER, TVMAZE_PROVIDER, WIKIDATA_PROVIDER, MANUAL_PROVIDER];
  }

  if (
    mediumType === WorkType.novel ||
    mediumType === WorkType.light_novel ||
    mediumType === WorkType.manga
  ) {
    return [
      ALADIN_PROVIDER,
      NAVER_BOOK_PROVIDER,
      KAKAO_BOOK_PROVIDER,
      GOOGLE_BOOKS_PROVIDER,
      OPEN_LIBRARY_PROVIDER,
      ANILIST_PROVIDER,
      WIKIDATA_PROVIDER,
      MANUAL_PROVIDER,
    ];
  }

  return [
    ALADIN_PROVIDER,
    ANILIST_PROVIDER,
    GOOGLE_BOOKS_PROVIDER,
    OPEN_LIBRARY_PROVIDER,
    TMDB_PROVIDER,
    TVMAZE_PROVIDER,
    WIKIDATA_PROVIDER,
    MANUAL_PROVIDER,
  ];
}

export function importProviderSupportsMedium(
  provider: ImportProvider,
  mediumType?: WorkType,
) {
  return !mediumType || PROVIDERS[provider].mediumTypes.includes(mediumType);
}

export function importCandidateMatchesMedium(
  candidate: ImportCandidateResponseDto,
  mediumType?: WorkType,
) {
  if (!mediumType || candidate.mediumType === mediumType) {
    return true;
  }

  if (mediumType === WorkType.web_novel) {
    return (
      candidate.mediumType === WorkType.novel ||
      candidate.mediumType === WorkType.light_novel
    );
  }

  if (mediumType === WorkType.webtoon) {
    return candidate.mediumType === WorkType.manga;
  }

  return false;
}

export function resolveGuestSearchProviders(input: {
  providers: ImportProvider[];
  searchQuery: ImportSearchQueryDto;
  serverSearchGuestEnabled: boolean;
  userId: string | null;
}) {
  if (input.userId) {
    return input.providers;
  }

  const allowedProviders = input.providers.filter((provider) => {
    const credentialMode = PROVIDERS[provider].credentialMode;

    return (
      credentialMode === 'none' ||
      (credentialMode === 'server' && input.serverSearchGuestEnabled)
    );
  });
  const requestedProviders = [
    ...(input.searchQuery.provider ? [input.searchQuery.provider] : []),
    ...(input.searchQuery.providers ?? []),
  ];
  const blockedRequestedProvider = requestedProviders.find((provider) => {
    return PROVIDERS[provider].credentialMode !== 'none';
  });

  if (blockedRequestedProvider) {
    const metadata = PROVIDERS[blockedRequestedProvider];

    if (metadata.credentialMode === 'user') {
      throw new UnauthorizedException(
        `${metadata.label} search requires a signed-in account.`,
      );
    }

    throw new ForbiddenException(
      `${metadata.label} search is not available for guest search.`,
    );
  }

  return allowedProviders;
}
