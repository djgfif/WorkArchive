import { WorkType } from '@prisma/client';

import {
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  TMDB_PROVIDER,
} from '../imports.constants';

export const ALADIN_ITEM_SEARCH_URL =
  'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
export const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
export const GOOGLE_BOOKS_SEARCH_URL =
  'https://www.googleapis.com/books/v1/volumes';
export const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
export const TVMAZE_SEARCH_URL = 'https://api.tvmaze.com/search/shows';
export const TMDB_SEARCH_MOVIE_URL =
  'https://api.themoviedb.org/3/search/movie';
export const TMDB_SEARCH_TV_URL = 'https://api.themoviedb.org/3/search/tv';
export const NAVER_BOOK_SEARCH_URL =
  'https://openapi.naver.com/v1/search/book.json';
export const KAKAO_BOOK_SEARCH_URL = 'https://dapi.kakao.com/v3/search/book';
export const NAVER_WEB_SEARCH_URL =
  'https://openapi.naver.com/v1/search/webkr.json';
export const KAKAO_WEB_SEARCH_URL = 'https://dapi.kakao.com/v2/search/web';
export const BRAVE_SEARCH_URL =
  'https://api.search.brave.com/res/v1/web/search';
export const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
// KOBIS still publishes this Open API over HTTP. The API key is user-scoped,
// sent as a query parameter, and never exposed to guests; see the provider
// hardening runbook before enabling it in production networks.
export const KOBIS_MOVIE_SEARCH_URL =
  'http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json';
export const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
export const WIKIDATA_USER_AGENT =
  'WorkArchive/1.0 (Wikidata enrichment provider; local-first personal archive)';
export const ALADIN_ATTRIBUTION =
  '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)';

export const DEFAULT_LIMIT = 10;
export const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;
export const MAX_LIMIT = 20;
export const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1_000;
export const PROVIDER_CIRCUIT_FAILURE_THRESHOLD = 3;
export const PROVIDER_CIRCUIT_OPEN_MS = 60_000;
export const WEB_SERIAL_INCLUDE_DOMAINS = [
  'series.naver.com',
  'comic.naver.com',
  'page.kakao.com',
  'webtoon.kakao.com',
  'ridibooks.com',
  'munpia.com',
  'novelpia.com',
  'joara.com',
] as const;

export const WIKIDATA_CLAIM_MAPPINGS = {
  contributor: {
    P50: 'author',
    P57: 'director',
    P86: 'composer',
    P98: 'editor',
    P110: 'illustrator',
    P170: 'creator',
    P178: 'studio',
    P272: 'production company',
    P287: 'designer',
    P676: 'lyricist',
  },
  externalRef: {
    P212: { provider: 'isbn', rawType: 'isbn13' },
    P345: { provider: 'imdb', rawType: 'title' },
    P648: { provider: 'open_library', rawType: 'work' },
    P675: { provider: 'google_books', rawType: 'volume' },
    P957: { provider: 'isbn', rawType: 'isbn10' },
    P1712: { provider: 'metacritic', rawType: 'work' },
    P1874: { provider: 'netflix', rawType: 'title' },
    P2437: { provider: 'kitsu', rawType: 'media' },
    P2603: { provider: 'kinopoisk', rawType: 'film' },
    P2704: { provider: 'eidr', rawType: 'work' },
    P3121: { provider: 'erogamescape', rawType: 'work' },
    P3302: { provider: 'open_media_database', rawType: 'title' },
    P4086: { provider: 'myanimelist', rawType: 'anime' },
    P4087: { provider: 'myanimelist', rawType: 'manga' },
    P4665: { provider: 'cine_magia', rawType: 'film' },
    P4835: { provider: 'thetvdb', rawType: 'series' },
    P4947: { provider: 'tmdb', rawType: 'movie' },
    P4983: { provider: 'tmdb', rawType: 'tv' },
    P5842: { provider: 'anilist', rawType: 'anime' },
    P8729: { provider: 'anilist', rawType: 'anime' },
    P8731: { provider: 'anilist', rawType: 'manga' },
  },
  franchise: ['P179'],
  image: ['P18'],
  instanceOf: ['P31'],
  partOf: ['P361'],
  publicationDate: ['P577'],
  releaseDate: ['P577', 'P580'],
} as const;

export const WIKIDATA_WORK_TYPE_QIDS: Partial<Record<WorkType, string[]>> = {
  [WorkType.anime]: ['Q1107', 'Q63952888', 'Q20650540'],
  [WorkType.drama]: ['Q5398426', 'Q15416', 'Q1259759'],
  [WorkType.light_novel]: ['Q747381'],
  [WorkType.manga]: ['Q8274', 'Q21198342'],
  [WorkType.movie]: ['Q11424'],
  [WorkType.novel]: ['Q8261', 'Q571', 'Q7725634'],
  [WorkType.web_novel]: ['Q7725634', 'Q8261'],
  [WorkType.webtoon]: ['Q20442589', 'Q8274', 'Q1004'],
};

export function isKobisHttpProviderEnabled() {
  if (process.env.NODE_ENV?.trim() !== 'production') {
    return true;
  }

  return process.env.KOBIS_HTTP_PROVIDER_ENABLED?.trim().toLowerCase() === 'true';
}

export function getKobisDisabledMessage() {
  return 'KOBIS HTTP provider is disabled in production unless KOBIS_HTTP_PROVIDER_ENABLED=true is explicitly configured.';
}

export function isServerSearchGuestEnabled() {
  return (
    process.env.IMPORT_SERVER_SEARCH_GUEST_ENABLED?.trim().toLowerCase() ===
    'true'
  );
}

export function getServerProviderApiKey(provider: string) {
  const credential = getServerProviderCredentialValues(provider);

  return credential ? Object.values(credential)[0] ?? '' : '';
}

export function hasServerProviderCredential(provider: string) {
  return getServerProviderCredentialValues(provider) !== null;
}

export function getServerProviderCredentialValues(provider: string) {
  switch (provider) {
    case TMDB_PROVIDER: {
      const readToken = readOptionalEnv('TMDB_API_READ_TOKEN');
      const apiKey = readOptionalEnv('TMDB_API_KEY');

      if (readToken) {
        return { readToken };
      }

      return apiKey ? { apiKey } : null;
    }

    case NAVER_BOOK_PROVIDER:
    case NAVER_WEB_PROVIDER: {
      const clientId = readOptionalEnv('NAVER_CLIENT_ID');
      const clientSecret = readOptionalEnv('NAVER_CLIENT_SECRET');

      return clientId && clientSecret ? { clientId, clientSecret } : null;
    }

    case KAKAO_BOOK_PROVIDER:
    case KAKAO_WEB_PROVIDER: {
      const restApiKey = readOptionalEnv('KAKAO_REST_API_KEY');

      return restApiKey ? { restApiKey } : null;
    }

    case KOBIS_PROVIDER: {
      const apiKey = readOptionalEnv('KOBIS_API_KEY');

      return apiKey ? { apiKey } : null;
    }

    default:
      return null;
  }
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : null;
}
