export const ALADIN_PROVIDER = 'aladin' as const;
export const MANUAL_PROVIDER = 'manual' as const;
export const ANILIST_PROVIDER = 'anilist' as const;
export const GOOGLE_BOOKS_PROVIDER = 'google_books' as const;
export const OPEN_LIBRARY_PROVIDER = 'open_library' as const;
export const TVMAZE_PROVIDER = 'tvmaze' as const;
export const TMDB_PROVIDER = 'tmdb' as const;
export const NAVER_BOOK_PROVIDER = 'naver_book' as const;
export const KAKAO_BOOK_PROVIDER = 'kakao_book' as const;
export const KOBIS_PROVIDER = 'kobis' as const;

export const IMPORT_PROVIDER_VALUES = [
  ALADIN_PROVIDER,
  MANUAL_PROVIDER,
  ANILIST_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TVMAZE_PROVIDER,
  TMDB_PROVIDER,
  NAVER_BOOK_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KOBIS_PROVIDER,
] as const;

export type ImportProvider = typeof IMPORT_PROVIDER_VALUES[number];
