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
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  getProviderSearchQueryVariants,
  shouldTrySearchFallback,
} from './import-provider-search-fallback';
import {
  searchAladin,
  searchGoogleBooks,
  searchKakaoBook,
  searchNaverBook,
  searchOpenLibrary,
} from './import-provider-search-books';
import {
  searchAniList,
  searchKobis,
  searchTmdb,
  searchTvMaze,
} from './import-provider-search-media';
import {
  searchBrave,
  searchKakaoWeb,
  searchNaverWeb,
  searchTavily,
} from './import-provider-search-web';
import { searchManual } from './import-provider-search-manual';
import { searchWikidata } from './import-provider-search-wikidata';
import type { ImportProviderSearchRuntime } from './import-provider-search-runtime';
export type { ImportProviderSearchRuntime } from './import-provider-search-runtime';

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
