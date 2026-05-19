import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
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
  type ImportProvider,
} from './imports.constants';

export interface ProviderCredentialField {
  description?: string;
  label: string;
  name: string;
  secret?: boolean;
}

export interface ProviderMetadata {
  credentialFields?: ProviderCredentialField[];
  credentialMode: 'none' | 'server' | 'user';
  label: string;
  mediumTypes: WorkType[];
  provider: ImportProvider;
}

export type ProviderCredentialValues = Record<string, string>;

export interface ProviderSearchContext {
  limit: number;
  mediumType?: WorkType;
  query: string;
  userId: string | null;
}

export interface ImportProviderAdapter {
  mapCandidate(
    raw: unknown,
    context: ProviderSearchContext,
  ): ImportCandidateResponseDto | null;
  resolveCredentials(
    context: ProviderSearchContext,
  ): Promise<ProviderCredentialValues | null>;
  search(context: ProviderSearchContext): Promise<ImportCandidateResponseDto[]>;
  supportsMedium(mediumType?: WorkType): boolean;
}

export const PROVIDERS: Record<ImportProvider, ProviderMetadata> = {
  [ALADIN_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        description: 'Aladin Open API TTBKey',
        label: 'TTBKey',
        name: 'ttbKey',
        secret: true,
      },
    ],
    label: 'Aladin Book',
    mediumTypes: [WorkType.novel, WorkType.light_novel, WorkType.manga],
    provider: ALADIN_PROVIDER,
  },
  [MANUAL_PROVIDER]: {
    credentialMode: 'none',
    label: 'Manual',
    mediumTypes: [
      WorkType.novel,
      WorkType.light_novel,
      WorkType.manga,
      WorkType.anime,
      WorkType.movie,
      WorkType.drama,
      WorkType.web_novel,
      WorkType.webtoon,
      WorkType.other,
    ],
    provider: MANUAL_PROVIDER,
  },
  [ANILIST_PROVIDER]: {
    credentialMode: 'none',
    label: 'AniList',
    mediumTypes: [
      WorkType.anime,
      WorkType.manga,
      WorkType.light_novel,
      WorkType.web_novel,
    ],
    provider: ANILIST_PROVIDER,
  },
  [GOOGLE_BOOKS_PROVIDER]: {
    credentialMode: 'none',
    label: 'Google Books',
    mediumTypes: [
      WorkType.novel,
      WorkType.light_novel,
      WorkType.manga,
      WorkType.web_novel,
      WorkType.webtoon,
    ],
    provider: GOOGLE_BOOKS_PROVIDER,
  },
  [OPEN_LIBRARY_PROVIDER]: {
    credentialMode: 'none',
    label: 'Open Library',
    mediumTypes: [WorkType.novel, WorkType.light_novel],
    provider: OPEN_LIBRARY_PROVIDER,
  },
  [TVMAZE_PROVIDER]: {
    credentialMode: 'none',
    label: 'TVmaze',
    mediumTypes: [WorkType.drama, WorkType.anime],
    provider: TVMAZE_PROVIDER,
  },
  [TMDB_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        description: 'TMDB API Read Access Token',
        label: 'Read Access Token',
        name: 'readToken',
        secret: true,
      },
    ],
    label: 'TMDB',
    mediumTypes: [WorkType.movie, WorkType.drama],
    provider: TMDB_PROVIDER,
  },
  [NAVER_BOOK_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        label: 'Client ID',
        name: 'clientId',
        secret: true,
      },
      {
        label: 'Client Secret',
        name: 'clientSecret',
        secret: true,
      },
    ],
    label: 'Naver Book',
    mediumTypes: [
      WorkType.novel,
      WorkType.light_novel,
      WorkType.manga,
      WorkType.web_novel,
      WorkType.webtoon,
    ],
    provider: NAVER_BOOK_PROVIDER,
  },
  [KAKAO_BOOK_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        description: 'Kakao Developers REST API key',
        label: 'REST API Key',
        name: 'restApiKey',
        secret: true,
      },
    ],
    label: 'Kakao Book',
    mediumTypes: [
      WorkType.novel,
      WorkType.light_novel,
      WorkType.manga,
      WorkType.web_novel,
      WorkType.webtoon,
    ],
    provider: KAKAO_BOOK_PROVIDER,
  },
  [NAVER_WEB_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        label: 'Client ID',
        name: 'clientId',
        secret: true,
      },
      {
        label: 'Client Secret',
        name: 'clientSecret',
        secret: true,
      },
    ],
    label: 'Naver Web',
    mediumTypes: [WorkType.web_novel, WorkType.webtoon],
    provider: NAVER_WEB_PROVIDER,
  },
  [KAKAO_WEB_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        description: 'Kakao Developers REST API key',
        label: 'REST API Key',
        name: 'restApiKey',
        secret: true,
      },
    ],
    label: 'Kakao Web',
    mediumTypes: [WorkType.web_novel, WorkType.webtoon],
    provider: KAKAO_WEB_PROVIDER,
  },
  [BRAVE_SEARCH_PROVIDER]: {
    credentialMode: 'server',
    label: 'Brave Search',
    mediumTypes: [WorkType.web_novel, WorkType.webtoon, WorkType.anime],
    provider: BRAVE_SEARCH_PROVIDER,
  },
  [TAVILY_SEARCH_PROVIDER]: {
    credentialMode: 'server',
    label: 'Tavily Search',
    mediumTypes: [WorkType.web_novel, WorkType.webtoon],
    provider: TAVILY_SEARCH_PROVIDER,
  },
  [KOBIS_PROVIDER]: {
    credentialMode: 'user',
    credentialFields: [
      {
        description: 'KOBIS Open API key',
        label: 'API Key',
        name: 'apiKey',
        secret: true,
      },
    ],
    label: 'KOBIS',
    mediumTypes: [WorkType.movie],
    provider: KOBIS_PROVIDER,
  },
};
