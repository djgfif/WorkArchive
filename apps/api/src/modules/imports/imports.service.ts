import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';

import {
  CatalogIngestionService,
  type CatalogExternalRefInput,
  type CatalogReleaseCandidateInput,
} from '../catalog/catalog-ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { mergeImportCandidates } from './import-candidate-merge';
import {
  normalizeImportCandidate,
  normalizeIsbn,
  normalizeReleaseDate,
  parseNormalizedReleaseYear,
  stripHtml,
} from './import-candidate-normalization';
import { rankImportCandidates } from './import-candidate-ranking';
import {
  addProviderDiagnostic,
  createImportSearchDiagnostics,
  type ImportSearchDiagnosticReasonCode,
  type ImportSearchDiagnosticStatus,
  type ImportSearchDiagnostics,
} from './import-search-diagnostics';
import { ImportsCredentialService } from './imports-credential.service';
import {
  ALADIN_PROVIDER,
  ANILIST_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  IMPORT_PROVIDER_VALUES,
  KAKAO_BOOK_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
  type ImportProvider,
} from './imports.constants';

const ALADIN_ITEM_SEARCH_URL =
  'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const GOOGLE_BOOKS_SEARCH_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const TVMAZE_SEARCH_URL = 'https://api.tvmaze.com/search/shows';
const TMDB_SEARCH_MOVIE_URL = 'https://api.themoviedb.org/3/search/movie';
const TMDB_SEARCH_TV_URL = 'https://api.themoviedb.org/3/search/tv';
const NAVER_BOOK_SEARCH_URL = 'https://openapi.naver.com/v1/search/book.json';
const KAKAO_BOOK_SEARCH_URL = 'https://dapi.kakao.com/v3/search/book';
const KOBIS_MOVIE_SEARCH_URL =
  'http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json';
const ALADIN_ATTRIBUTION = '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)';
const DEFAULT_LIMIT = 10;
const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;
const MAX_LIMIT = 20;
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1_000;

type UnknownRecord = Record<string, unknown>;

interface ProviderMetadata {
  credentialMode: 'none' | 'server' | 'user';
  credentialFields?: ProviderCredentialField[];
  label: string;
  mediumTypes: WorkType[];
  provider: ImportProvider;
}

interface ProviderCredentialField {
  description?: string;
  label: string;
  name: string;
  secret?: boolean;
}

interface ProviderSearchContext {
  limit: number;
  mediumType?: WorkType;
  query: string;
  userId: string | null;
}

type ProviderCredentialValues = Record<string, string>;

const PROVIDERS: Record<ImportProvider, ProviderMetadata> = {
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
    mediumTypes: [WorkType.novel, WorkType.light_novel, WorkType.manga],
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
    mediumTypes: [WorkType.novel, WorkType.light_novel, WorkType.manga],
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
    mediumTypes: [WorkType.novel, WorkType.light_novel, WorkType.manga],
    provider: KAKAO_BOOK_PROVIDER,
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

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly providerResponseCache = new Map<
    string,
    {
      expiresAt: number;
      value: unknown;
    }
  >();

  constructor(
    @Inject(ImportsCredentialService)
    private readonly credentialService: ImportsCredentialService,
    @Inject(CatalogIngestionService)
    private readonly catalogIngestionService: CatalogIngestionService = {
      findCatalogMatchForImportCandidate: async () => null,
    } as unknown as CatalogIngestionService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService = {
      catalogExternalRef: {
        findUnique: async () => null,
      },
      userWorkRecord: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService,
  ) {}

  async getAladinProviderStatus(
    userId: string,
  ): Promise<Pick<ImportProviderStatusResponseDto, 'configured' | 'provider'>> {
    return {
      provider: ALADIN_PROVIDER,
      configured: await this.credentialService.hasCredential(
        userId,
        ALADIN_PROVIDER,
      ),
    };
  }

  async listProviders(
    userId: string | null,
  ): Promise<ImportProviderStatusResponseDto[]> {
    return Promise.all(
      IMPORT_PROVIDER_VALUES.map(async (provider) => {
        const metadata = PROVIDERS[provider];

        return {
          configured: await this.isProviderConfigured(userId, provider),
          credentialMode: metadata.credentialMode,
          label: metadata.label,
          mediumTypes: metadata.mediumTypes,
          provider,
          ...(metadata.credentialFields
            ? { credentialFields: metadata.credentialFields }
            : {}),
        };
      }),
    );
  }

  async saveAladinKey(
    userId: string,
    ttbKey: string,
  ): Promise<Pick<ImportProviderStatusResponseDto, 'configured' | 'provider'>> {
    await this.saveProviderKey(userId, ALADIN_PROVIDER, { ttbKey });

    return {
      provider: ALADIN_PROVIDER,
      configured: true,
    };
  }

  async deleteAladinKey(userId: string) {
    await this.deleteProviderKey(userId, ALADIN_PROVIDER);
  }

  async saveProviderKey(
    userId: string,
    providerInput: string,
    values: ProviderCredentialValues,
  ): Promise<ImportProviderStatusResponseDto> {
    const provider = this.assertUserCredentialProvider(providerInput);
    const credentialValues = this.normalizeCredentialValues(provider, values);

    await this.credentialService.saveCredential(
      userId,
      provider,
      JSON.stringify(credentialValues),
    );

    return this.buildProviderStatus(provider, true);
  }

  async deleteProviderKey(userId: string, providerInput: string) {
    const provider = this.assertUserCredentialProvider(providerInput);

    await this.credentialService.deleteCredential(userId, provider);
  }

  async search(
    userId: string | null,
    searchQuery: ImportSearchQueryDto,
  ): Promise<ImportSearchResponseDto> {
    const query = searchQuery.query.trim();
    const limit = this.normalizeLimit(searchQuery.limit);
    const mediumType = searchQuery.mediumType ?? searchQuery.type;
    const resolvedProviders = this.resolveProviders(searchQuery, mediumType);
    const providers = this.resolveSearchProviders(
      resolvedProviders,
      searchQuery,
      userId,
    );
    const explicitSingleProvider =
      searchQuery.provider !== undefined && searchQuery.providers === undefined;

    if (!query) {
      throw new BadRequestException('query must not be empty');
    }

    const candidates: ImportCandidateResponseDto[] = [];
    const failures: string[] = [];
    const diagnostics = createImportSearchDiagnostics();

    for (const provider of resolvedProviders) {
      if (!this.supportsMedium(provider, mediumType)) {
        this.addSearchDiagnostic(diagnostics, provider, {
          configured: await this.isProviderConfigured(userId, provider),
          message: `${PROVIDERS[provider].label} does not support the selected work type.`,
          reasonCode: 'unsupported_medium',
          resultCount: 0,
          status: 'skipped',
        });
        continue;
      }

      if (!providers.includes(provider)) {
        const metadata = PROVIDERS[provider];

        this.addSearchDiagnostic(diagnostics, provider, {
          configured: await this.isProviderConfigured(userId, provider),
          message:
            metadata.credentialMode === 'user'
              ? `${metadata.label} search requires a signed-in account.`
              : `${metadata.label} search is not available for guest search.`,
          reasonCode: 'guest_provider_not_allowed',
          resultCount: 0,
          status: 'skipped',
        });
        continue;
      }

      const configured = await this.isProviderConfigured(userId, provider);

      if (!configured && PROVIDERS[provider].credentialMode === 'server') {
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search is not configured on this server.`,
          reasonCode: 'server_credential_missing',
          resultCount: 0,
          status: 'skipped',
        });
        continue;
      }

      if (
        !configured &&
        PROVIDERS[provider].credentialMode === 'user' &&
        !explicitSingleProvider
      ) {
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search requires a configured user key.`,
          reasonCode: 'user_credential_missing',
          resultCount: 0,
          status: 'skipped',
        });
        continue;
      }

      try {
        const context: ProviderSearchContext = {
          limit,
          query,
          userId,
        };

        if (mediumType !== undefined) {
          context.mediumType = mediumType;
        }

        const providerCandidates = await this.searchProvider(provider, context);

        candidates.push(...providerCandidates);
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search completed.`,
          reasonCode: null,
          resultCount: providerCandidates.length,
          status: 'searched',
        });
      } catch (error) {
        if (explicitSingleProvider) {
          throw error;
        }

        failures.push(`${provider}:${this.describeError(error)}`);
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search is temporarily unavailable.`,
          reasonCode: 'provider_failed',
          resultCount: 0,
          status: 'failed',
        });
      }
    }

    const decoratedCandidates = await this.decorateCandidates(
      userId,
      mergeImportCandidates(candidates),
    );
    const decoratedMergedCandidates =
      mergeImportCandidates(decoratedCandidates);
    const rankedCandidates = rankImportCandidates({
      candidates: decoratedMergedCandidates,
      ...(mediumType === undefined ? {} : { mediumType }),
      query,
    }).slice(0, limit);

    this.logSearchSummary(
      userId,
      providers.join(','),
      query,
      rankedCandidates.length,
      failures.length > 0 ? `partial:${failures.join('|')}` : 'ok',
    );

    return {
      provider: searchQuery.provider ?? providers[0] ?? ALADIN_PROVIDER,
      providers,
      query,
      candidates: rankedCandidates,
      diagnostics,
    };
  }

  private normalizeLimit(limit: number | undefined) {
    if (limit === undefined) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private resolveProviders(
    searchQuery: ImportSearchQueryDto,
    mediumType?: WorkType,
  ): ImportProvider[] {
    if (searchQuery.providers && searchQuery.providers.length > 0) {
      return searchQuery.providers;
    }

    if (searchQuery.provider) {
      return [searchQuery.provider];
    }

    if (mediumType === WorkType.web_novel || mediumType === WorkType.webtoon) {
      return [MANUAL_PROVIDER];
    }

    if (mediumType === WorkType.anime) {
      return [ANILIST_PROVIDER, TVMAZE_PROVIDER, MANUAL_PROVIDER];
    }

    if (mediumType === WorkType.movie) {
      return [TMDB_PROVIDER, KOBIS_PROVIDER, MANUAL_PROVIDER];
    }

    if (mediumType === WorkType.drama) {
      return [TMDB_PROVIDER, TVMAZE_PROVIDER, MANUAL_PROVIDER];
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
      MANUAL_PROVIDER,
    ];
  }

  private supportsMedium(provider: ImportProvider, mediumType?: WorkType) {
    return !mediumType || PROVIDERS[provider].mediumTypes.includes(mediumType);
  }

  private resolveSearchProviders(
    providers: ImportProvider[],
    searchQuery: ImportSearchQueryDto,
    userId: string | null,
  ) {
    if (userId) {
      return providers;
    }

    const allowedProviders = providers.filter((provider) => {
      return PROVIDERS[provider].credentialMode === 'none';
    });
    const requestedProviders = [
      ...(searchQuery.provider ? [searchQuery.provider] : []),
      ...(searchQuery.providers ?? []),
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

  private async isProviderConfigured(
    userId: string | null,
    provider: ImportProvider,
  ) {
    const metadata = PROVIDERS[provider];

    if (metadata.credentialMode === 'none') {
      return true;
    }

    if (!userId) {
      return false;
    }

    if (metadata.credentialMode === 'user') {
      return this.credentialService.hasCredential(userId, provider);
    }

    return false;
  }

  private async searchProvider(
    provider: ImportProvider,
    context: ProviderSearchContext,
  ) {
    switch (provider) {
      case ALADIN_PROVIDER:
        return this.searchAladin(context);
      case ANILIST_PROVIDER:
        return this.searchAniList(context);
      case GOOGLE_BOOKS_PROVIDER:
        return this.searchGoogleBooks(context);
      case OPEN_LIBRARY_PROVIDER:
        return this.searchOpenLibrary(context);
      case TVMAZE_PROVIDER:
        return this.searchTvMaze(context);
      case TMDB_PROVIDER:
        return this.searchTmdb(context);
      case NAVER_BOOK_PROVIDER:
        return this.searchNaverBook(context);
      case KAKAO_BOOK_PROVIDER:
        return this.searchKakaoBook(context);
      case KOBIS_PROVIDER:
        return this.searchKobis(context);
      case MANUAL_PROVIDER:
        return this.searchManual(context);
    }
  }

  private async searchAladin({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    if (!userId) {
      throw new UnauthorizedException(
        'Aladin search requires a signed-in account.',
      );
    }

    const credentials = await this.getProviderCredentialValues(
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
    });

    if (!this.isRecord(responseBody)) {
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
      .map((item, index) => this.mapAladinItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchAniList({
    limit,
    mediumType,
    query,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
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
      const responseBody = await this.fetchJson(ANILIST_GRAPHQL_URL, {
        accept: 'application/json',
        body: JSON.stringify(body),
        cacheKey: this.getProviderCacheKey({
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
      const media = this.readPathArray(responseBody, ['data', 'Page', 'media']);

      results.push(
        ...media
          .map((item, index) => this.mapAniListItem(item, index, mediaType))
          .filter((candidate): candidate is ImportCandidateResponseDto => {
            return (
              candidate !== null &&
              (!mediumType || candidate.mediumType === mediumType)
            );
          }),
      );
    }

    return results;
  }

  private async searchGoogleBooks({
    limit,
    mediumType,
    query,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const searchUrl = new URL(GOOGLE_BOOKS_SEARCH_URL);

    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('maxResults', Math.min(limit, 20).toString());

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: GOOGLE_BOOKS_PROVIDER,
        query,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    });
    const items = this.readPathArray(responseBody, ['items']);

    return items
      .map((item, index) => this.mapGoogleBookItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchOpenLibrary({
    limit,
    mediumType,
    query,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const searchUrl = new URL(OPEN_LIBRARY_SEARCH_URL);

    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('limit', Math.min(limit, 20).toString());

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: OPEN_LIBRARY_PROVIDER,
        query,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    });
    const docs = this.readPathArray(responseBody, ['docs']);

    return docs
      .map((item, index) => this.mapOpenLibraryItem(item, index))
      .filter(
        (candidate): candidate is ImportCandidateResponseDto =>
          candidate !== null,
      );
  }

  private async searchTvMaze({
    limit,
    mediumType,
    query,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const searchUrl = new URL(TVMAZE_SEARCH_URL);

    searchUrl.searchParams.set('q', query);

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
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
      .map((item, index) => this.mapTvMazeItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchTmdb({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValues(userId, TMDB_PROVIDER)
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

      const fetchOptions: Parameters<typeof this.fetchJson>[1] = {
        accept: 'application/json',
        cacheKey: this.getProviderCacheKey({
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

      const responseBody = await this.fetchJson(url, fetchOptions);
      const results = this.readPathArray(responseBody, ['results']);

      candidates.push(
        ...results
          .slice(0, limit)
          .map((item, index) => this.mapTmdbItem(item, index, rawType))
          .filter(
            (candidate): candidate is ImportCandidateResponseDto =>
              candidate !== null,
          ),
      );
    }

    return candidates;
  }

  private async searchNaverBook({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValues(userId, NAVER_BOOK_PROVIDER)
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
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
    const items = this.readPathArray(responseBody, ['items']);

    return items
      .map((item, index) => this.mapNaverBookItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchKakaoBook({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValues(userId, KAKAO_BOOK_PROVIDER)
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      bearerPrefix: 'KakaoAK',
      bearerToken: restApiKey,
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: KAKAO_BOOK_PROVIDER,
        query,
        userScope: userId,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    });
    const documents = this.readPathArray(responseBody, ['documents']);

    return documents
      .map((item, index) => this.mapKakaoBookItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchKobis({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValues(userId, KOBIS_PROVIDER)
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: KOBIS_PROVIDER,
        query,
        userScope: userId,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    });
    const movies = this.readPathArray(responseBody, [
      'movieListResult',
      'movieList',
    ]);

    return movies
      .map((item, index) => this.mapKobisMovieItem(item, index))
      .filter(
        (candidate): candidate is ImportCandidateResponseDto =>
          candidate !== null,
      );
  }

  private searchManual({
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
      this.buildCandidate({
        confidence: index === 0 ? 0.55 : 0.35,
        confidenceLabel: index === 0 ? '수동 후보' : '매체 후보',
        countLabel: '사용자 검토 필요',
        description:
          '공식 API 후보가 없거나 웹연재처럼 공개 메타데이터 API가 부족한 경우를 위한 수동 후보입니다. 스크래핑 없이 사용자가 직접 확인합니다.',
        externalId: `${query}:${type}`,
        externalRefs: [],
        formatLabel: this.getFormatLabel(type),
        id: `${MANUAL_PROVIDER}:${query}:${type}`,
        note: '공식 API/수동 입력만 사용하며 스크래핑하지 않습니다.',
        provider: MANUAL_PROVIDER,
        reason: '수동 입력 fallback',
        sourceLabel: 'Manual',
        title:
          type === mediumType
            ? query
            : `${query} (${this.getFormatLabel(type)})`,
        type,
      }),
    );
  }

  private mapAladinItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.readString(item.title).trim();

    if (!title) {
      return null;
    }

    const externalId =
      this.readString(item.itemId) ||
      this.readString(item.isbn13) ||
      this.readString(item.isbn) ||
      title;
    const categoryName = this.readString(item.categoryName);
    const publisher = this.readString(item.publisher);
    const publishedAt = this.readString(item.pubDate);
    const type = this.mapBookWorkType(categoryName, title);
    const sourceUrl = this.readString(item.link).trim();
    const thumbnailUrl = this.readString(item.cover).trim();

    return this.buildCandidate({
      author: this.readString(item.author).trim(),
      confidence: index === 0 ? 0.86 : 0.68,
      confidenceLabel: index === 0 ? '가장 유력' : '후보',
      countLabel:
        [publisher, publishedAt].filter(Boolean).join(' · ') ||
        `Aladin ID ${externalId}`,
      description: this.normalizeWhitespace(this.readString(item.description)),
      externalId,
      externalRefs: [],
      formatLabel: this.getFormatLabel(type),
      genresText: this.toGenresText(categoryName),
      id: `${ALADIN_PROVIDER}:${externalId}`,
      note: ALADIN_ATTRIBUTION,
      provider: ALADIN_PROVIDER,
      releaseCandidates: this.buildBookReleaseCandidates({
        externalId,
        isbn: this.readString(item.isbn13) || this.readString(item.isbn),
        provider: ALADIN_PROVIDER,
        releaseDate: publishedAt,
        thumbnailUrl,
        title,
        url: sourceUrl,
      }),
      reason: '제목/도서 카테고리 일치',
      releaseYear: this.parseYear(publishedAt),
      sourceLabel: 'Aladin Book',
      sourceUrl,
      thumbnailUrl,
      title,
      type,
    });
  }

  private mapAniListItem(
    item: unknown,
    index: number,
    mediaType: string,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const titleObject = this.isRecord(item.title) ? item.title : {};
    const title =
      this.readString(titleObject.english) ||
      this.readString(titleObject.romaji) ||
      this.readString(titleObject.native);
    const titleAliases = [
      this.readString(titleObject.english),
      this.readString(titleObject.romaji),
      this.readString(titleObject.native),
    ].filter(Boolean);

    if (!title) {
      return null;
    }

    const format = this.readString(item.format);
    const type =
      mediaType === 'ANIME'
        ? WorkType.anime
        : format === 'NOVEL'
          ? WorkType.light_novel
          : WorkType.manga;
    const studios = this.readPathArray(item, ['studios', 'nodes'])
      .map((studio) =>
        this.isRecord(studio) ? this.readString(studio.name) : '',
      )
      .filter(Boolean);
    const staff = this.readPathArray(item, ['staff', 'nodes'])
      .map((person) =>
        this.isRecord(person) && this.isRecord(person.name)
          ? this.readString(person.name.full)
          : '',
      )
      .filter(Boolean);
    const contributors = [...studios, ...staff].slice(0, 4);

    return this.buildCandidate({
      author: contributors.join(', '),
      confidence: index === 0 ? 0.82 : 0.64,
      confidenceLabel: index === 0 ? 'AniList 상위' : 'AniList 후보',
      countLabel: format || 'AniList media',
      description: this.normalizeWhitespace(this.readString(item.description)),
      externalId: this.readString(item.id),
      formatLabel: this.getFormatLabel(type),
      id: `${ANILIST_PROVIDER}:${this.readString(item.id)}`,
      note: 'AniList GraphQL public API',
      provider: ANILIST_PROVIDER,
      reason: 'AniList 제목 검색 결과',
      releaseYear: this.readPathNumber(item, ['startDate', 'year']),
      sourceLabel: 'AniList',
      sourceUrl: `https://anilist.co/${mediaType === 'ANIME' ? 'anime' : 'manga'}/${this.readString(item.id)}`,
      subType: format ? format.toLowerCase() : null,
      thumbnailUrl: this.isRecord(item.coverImage)
        ? this.readString(item.coverImage.large)
        : '',
      title,
      titleAliases,
      type,
    });
  }

  private mapGoogleBookItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const volumeInfo = this.isRecord(item.volumeInfo) ? item.volumeInfo : {};
    const title = this.readString(volumeInfo.title);

    if (!title) {
      return null;
    }

    const categories = this.readStringArray(volumeInfo.categories).join(', ');
    const type = this.mapBookWorkType(categories, title);
    const imageLinks = this.isRecord(volumeInfo.imageLinks)
      ? volumeInfo.imageLinks
      : {};
    const sourceUrl = this.readString(volumeInfo.infoLink);
    const thumbnailUrl =
      this.readString(imageLinks.thumbnail) ||
      this.readString(imageLinks.smallThumbnail);
    const subtitle = this.readString(volumeInfo.subtitle);

    return this.buildCandidate({
      author: this.readStringArray(volumeInfo.authors).join(', '),
      confidence: index === 0 ? 0.74 : 0.58,
      confidenceLabel: index === 0 ? 'Google 상위' : 'Google 후보',
      countLabel:
        [
          this.readString(volumeInfo.publisher),
          this.readString(volumeInfo.publishedDate),
        ]
          .filter(Boolean)
          .join(' · ') || 'Google Books',
      description: this.normalizeWhitespace(
        this.readString(volumeInfo.description),
      ),
      externalId: this.readString(item.id),
      externalRefs: [],
      formatLabel: this.getFormatLabel(type),
      genresText: categories,
      id: `${GOOGLE_BOOKS_PROVIDER}:${this.readString(item.id)}`,
      note: 'Google Books Volumes API',
      provider: GOOGLE_BOOKS_PROVIDER,
      releaseCandidates: this.buildBookReleaseCandidates({
        externalId: this.readString(item.id),
        isbn: this.readGoogleBooksIsbn(volumeInfo.industryIdentifiers),
        provider: GOOGLE_BOOKS_PROVIDER,
        releaseDate: this.readString(volumeInfo.publishedDate),
        thumbnailUrl,
        title,
        url: sourceUrl,
      }),
      reason: 'Google Books 제목 검색 결과',
      releaseYear: this.parseYear(this.readString(volumeInfo.publishedDate)),
      sourceLabel: 'Google Books',
      sourceUrl,
      thumbnailUrl,
      title,
      titleAliases: [
        title,
        subtitle,
        title && subtitle ? `${title}: ${subtitle}` : '',
      ].filter(Boolean),
      type,
    });
  }

  private mapOpenLibraryItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.readString(item.title);

    if (!title) {
      return null;
    }

    const key = this.readString(item.key);
    const sourceUrl = key ? `https://openlibrary.org${key}` : '';
    const titleAliases = [
      title,
      ...this.readStringArray(item.alternative_title),
      ...this.readStringArray(item.title_suggest),
      this.readString(item.title_suggest),
    ].filter(Boolean);

    return this.buildCandidate({
      author: this.readStringArray(item.author_name).slice(0, 3).join(', '),
      confidence: index === 0 ? 0.68 : 0.5,
      confidenceLabel: index === 0 ? 'Open Library 상위' : 'Open Library 후보',
      countLabel: this.readNumber(item.first_publish_year)
        ? `${this.readNumber(item.first_publish_year)}`
        : 'Open Library',
      externalId: key || title,
      formatLabel: '소설/도서',
      id: `${OPEN_LIBRARY_PROVIDER}:${key || title}`,
      note: 'Open Library Search API',
      provider: OPEN_LIBRARY_PROVIDER,
      releaseCandidates: this.buildBookReleaseCandidates({
        externalId: key || title,
        isbn: this.readOpenLibraryIsbn(item.isbn),
        provider: OPEN_LIBRARY_PROVIDER,
        releaseDate:
          this.readNumber(item.first_publish_year)?.toString() ?? null,
        title,
        url: sourceUrl,
      }),
      reason: 'Open Library 제목 검색 결과',
      releaseYear: this.readNumber(item.first_publish_year),
      sourceLabel: 'Open Library',
      sourceUrl,
      title,
      titleAliases,
      type: WorkType.novel,
    });
  }

  private mapTvMazeItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item) || !this.isRecord(item.show)) {
      return null;
    }

    const show = item.show;
    const title = this.readString(show.name);

    if (!title) {
      return null;
    }

    const image = this.isRecord(show.image) ? show.image : {};

    return this.buildCandidate({
      confidence: index === 0 ? 0.7 : 0.52,
      confidenceLabel: index === 0 ? 'TVmaze 상위' : 'TVmaze 후보',
      countLabel: this.readString(show.premiered) || 'TV series',
      description: this.normalizeWhitespace(
        this.stripHtml(this.readString(show.summary)),
      ),
      externalId: this.readString(show.id),
      formatLabel: '드라마/TV',
      genresText: this.readStringArray(show.genres).join(', '),
      id: `${TVMAZE_PROVIDER}:${this.readString(show.id)}`,
      note: 'TVmaze public API',
      provider: TVMAZE_PROVIDER,
      reason: 'TVmaze 쇼 검색 결과',
      releaseYear: this.parseYear(this.readString(show.premiered)),
      sourceLabel: 'TVmaze',
      sourceUrl: this.readString(show.url),
      thumbnailUrl:
        this.readString(image.medium) || this.readString(image.original),
      title,
      type: WorkType.drama,
    });
  }

  private mapTmdbItem(
    item: unknown,
    index: number,
    rawType: 'movie' | 'tv',
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title =
      rawType === 'movie'
        ? this.readString(item.title)
        : this.readString(item.name);
    const originalTitle =
      rawType === 'movie'
        ? this.readString(item.original_title)
        : this.readString(item.original_name);

    if (!title) {
      return null;
    }

    const date =
      rawType === 'movie'
        ? this.readString(item.release_date)
        : this.readString(item.first_air_date);
    const posterPath = this.readString(item.poster_path);
    const type = rawType === 'movie' ? WorkType.movie : WorkType.drama;

    return this.buildCandidate({
      confidence: index === 0 ? 0.78 : 0.58,
      confidenceLabel: index === 0 ? 'TMDB 상위' : 'TMDB 후보',
      countLabel: date || 'TMDB',
      description: this.normalizeWhitespace(this.readString(item.overview)),
      externalId: this.readString(item.id),
      formatLabel: this.getFormatLabel(type),
      id: `${TMDB_PROVIDER}:${rawType}:${this.readString(item.id)}`,
      note: 'TMDB API',
      provider: TMDB_PROVIDER,
      reason: 'TMDB 제목 검색 결과',
      rawType,
      releaseYear: this.parseYear(date),
      sourceLabel: 'TMDB',
      sourceUrl: `https://www.themoviedb.org/${rawType}/${this.readString(item.id)}`,
      thumbnailUrl: posterPath
        ? `https://image.tmdb.org/t/p/w500${posterPath}`
        : '',
      title,
      titleAliases: [title, originalTitle].filter(Boolean),
      type,
    });
  }

  private mapNaverBookItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.stripHtml(this.readString(item.title));

    if (!title) {
      return null;
    }

    const type = this.mapBookWorkType('', title);
    const externalId =
      this.readString(item.isbn) || this.readString(item.link) || title;

    return this.buildCandidate({
      author: this.stripHtml(this.readString(item.author)),
      confidence: index === 0 ? 0.72 : 0.54,
      confidenceLabel: index === 0 ? 'Naver 상위' : 'Naver 후보',
      countLabel:
        [
          this.stripHtml(this.readString(item.publisher)),
          this.readString(item.pubdate),
        ]
          .filter(Boolean)
          .join(' · ') || 'Naver Book',
      description: this.normalizeWhitespace(
        this.stripHtml(this.readString(item.description)),
      ),
      externalId,
      externalRefs: [],
      formatLabel: this.getFormatLabel(type),
      id: `${NAVER_BOOK_PROVIDER}:${externalId}`,
      note: 'Naver Search Book API',
      provider: NAVER_BOOK_PROVIDER,
      releaseCandidates: this.buildBookReleaseCandidates({
        externalId,
        isbn: this.readString(item.isbn),
        provider: NAVER_BOOK_PROVIDER,
        releaseDate: this.readString(item.pubdate),
        thumbnailUrl: this.readString(item.image),
        title,
        url: this.readString(item.link),
      }),
      reason: 'Naver 도서 검색 결과',
      releaseYear: this.parseYear(this.readString(item.pubdate)),
      sourceLabel: 'Naver Book',
      sourceUrl: this.readString(item.link),
      thumbnailUrl: this.readString(item.image),
      title,
      type,
    });
  }

  private mapKakaoBookItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.readString(item.title);

    if (!title) {
      return null;
    }

    const type = this.mapBookWorkType('', title);
    const externalId =
      this.readString(item.isbn) || this.readString(item.url) || title;

    return this.buildCandidate({
      author: this.readStringArray(item.authors).join(', '),
      confidence: index === 0 ? 0.72 : 0.54,
      confidenceLabel: index === 0 ? 'Kakao 상위' : 'Kakao 후보',
      countLabel:
        [
          this.readString(item.publisher),
          this.readString(item.datetime).slice(0, 10),
        ]
          .filter(Boolean)
          .join(' · ') || 'Kakao Book',
      description: this.normalizeWhitespace(this.readString(item.contents)),
      externalId,
      externalRefs: [],
      formatLabel: this.getFormatLabel(type),
      id: `${KAKAO_BOOK_PROVIDER}:${externalId}`,
      note: 'Kakao Daum Book Search API',
      provider: KAKAO_BOOK_PROVIDER,
      releaseCandidates: this.buildBookReleaseCandidates({
        externalId,
        isbn: this.readString(item.isbn),
        provider: KAKAO_BOOK_PROVIDER,
        releaseDate: this.readString(item.datetime),
        thumbnailUrl: this.readString(item.thumbnail),
        title,
        url: this.readString(item.url),
      }),
      reason: 'Kakao 도서 검색 결과',
      releaseYear: this.parseYear(this.readString(item.datetime)),
      sourceLabel: 'Kakao Book',
      sourceUrl: this.readString(item.url),
      thumbnailUrl: this.readString(item.thumbnail),
      title,
      type,
    });
  }

  private mapKobisMovieItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.readString(item.movieNm);

    if (!title) {
      return null;
    }

    return this.buildCandidate({
      author: this.readString(item.directors),
      confidence: index === 0 ? 0.75 : 0.55,
      confidenceLabel: index === 0 ? 'KOBIS 상위' : 'KOBIS 후보',
      countLabel:
        [this.readString(item.openDt), this.readString(item.repNationNm)]
          .filter(Boolean)
          .join(' · ') || 'KOBIS movie',
      externalId: this.readString(item.movieCd) || title,
      formatLabel: '영화',
      id: `${KOBIS_PROVIDER}:${this.readString(item.movieCd) || title}`,
      note: 'KOBIS Open API',
      provider: KOBIS_PROVIDER,
      reason: 'KOBIS 영화명 검색 결과',
      releaseYear: this.parseYear(
        this.readString(item.prdtYear) || this.readString(item.openDt),
      ),
      sourceLabel: 'KOBIS',
      title,
      type: WorkType.movie,
    });
  }

  private buildCandidate(
    input: Partial<ImportCandidateResponseDto> & {
      externalId: string;
      provider: ImportProvider;
      rawType?: string;
      title: string;
      type: WorkType;
    },
  ): ImportCandidateResponseDto {
    const contributors =
      input.contributors ?? this.toContributorList(input.author);
    const rawType = input.rawType ?? input.type;

    return normalizeImportCandidate({
      author:
        input.author ?? contributors.map((entry) => entry.name).join(', '),
      catalogMatch: null,
      confidence: input.confidence ?? 0.5,
      confidenceLabel: input.confidenceLabel ?? '후보',
      contributors,
      countLabel: input.countLabel ?? '',
      description: input.description ?? '',
      existingRecord: null,
      externalId: input.externalId,
      externalRefs: input.externalRefs ?? [
        {
          externalId: input.externalId,
          provider: input.provider,
          rawType,
          url: input.sourceUrl ?? '',
        },
      ],
      formatLabel: input.formatLabel ?? this.getFormatLabel(input.type),
      franchiseName: input.franchiseName ?? null,
      genresText: input.genresText ?? '',
      id: input.id ?? `${input.provider}:${input.externalId}`,
      mediumType: input.type,
      note: input.note ?? '',
      reason: input.reason ?? '',
      releaseCandidates: input.releaseCandidates ?? [],
      relationsHint: input.relationsHint ?? [],
      releaseYear: input.releaseYear ?? null,
      sourceId: input.provider,
      sourceLabel: input.sourceLabel ?? PROVIDERS[input.provider].label,
      sourceUrl: input.sourceUrl ?? '',
      sourceCoverage: {
        externalIdentityCount: 0,
        providerCount: 0,
        providers: [],
        releaseCandidateCount: 0,
      },
      subType: input.subType ?? null,
      thumbnailUrl: input.thumbnailUrl ?? '',
      title: input.title,
      titleAliases: input.titleAliases ?? [],
      type: input.type,
      scoreBreakdown: input.scoreBreakdown ?? [],
    });
  }

  private async decorateCandidates(
    userId: string | null,
    candidates: ImportCandidateResponseDto[],
  ) {
    return Promise.all(
      candidates.map(async (candidate) => {
        const catalogMatch =
          await this.catalogIngestionService.findCatalogMatchForImportCandidate(
            {
              contributorNames: candidate.contributors.map(
                (contributor) => contributor.name,
              ),
              externalRefs: candidate.externalRefs,
              franchiseName: candidate.franchiseName,
              mediumType: candidate.mediumType,
              releaseCandidates: candidate.releaseCandidates,
              releaseYear: candidate.releaseYear,
              title: candidate.title,
            },
          );
        const existingRecord =
          catalogMatch && userId
            ? await this.prisma.userWorkRecord.findFirst({
                where: {
                  catalogTitleId: catalogMatch.id,
                  deletedAt: null,
                  userId,
                },
                select: {
                  id: true,
                  status: true,
                },
              })
            : null;

        return {
          ...candidate,
          catalogMatch,
          existingRecord,
        };
      }),
    );
  }

  private buildProviderStatus(
    provider: ImportProvider,
    configured: boolean,
  ): ImportProviderStatusResponseDto {
    const metadata = PROVIDERS[provider];

    return {
      configured,
      credentialMode: metadata.credentialMode,
      label: metadata.label,
      mediumTypes: metadata.mediumTypes,
      provider,
      ...(metadata.credentialFields
        ? { credentialFields: metadata.credentialFields }
        : {}),
    };
  }

  private assertUserCredentialProvider(providerInput: string) {
    if (!(IMPORT_PROVIDER_VALUES as readonly string[]).includes(providerInput)) {
      throw new BadRequestException('Unsupported import provider.');
    }

    const provider = providerInput as ImportProvider;
    const metadata = PROVIDERS[provider];

    if (metadata.credentialMode !== 'user') {
      throw new BadRequestException(
        `${metadata.label} does not accept user API keys.`,
      );
    }

    return provider;
  }

  private normalizeCredentialValues(
    provider: ImportProvider,
    values: ProviderCredentialValues,
  ) {
    const fields = PROVIDERS[provider].credentialFields ?? [];
    const normalized: ProviderCredentialValues = {};

    for (const field of fields) {
      const value = values[field.name]?.trim();

      if (!value) {
        throw new BadRequestException(`${field.label} is required.`);
      }

      normalized[field.name] = value;
    }

    return normalized;
  }

  private async getProviderCredentialValues(
    userId: string,
    provider: ImportProvider,
  ) {
    const rawCredential = await this.credentialService.getDecryptedCredential(
      userId,
      provider,
    );

    if (!rawCredential) {
      return null;
    }

    return this.parseCredentialValues(provider, rawCredential);
  }

  private parseCredentialValues(
    provider: ImportProvider,
    rawCredential: string,
  ) {
    const rawValue = rawCredential.trim();

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;

      if (this.isRecord(parsed)) {
        const values: ProviderCredentialValues = {};

        for (const field of PROVIDERS[provider].credentialFields ?? []) {
          const value = parsed[field.name];

          if (typeof value === 'string' && value.trim()) {
            values[field.name] = value.trim();
          }
        }

        return Object.keys(values).length > 0 ? values : null;
      }
    } catch {
      // Legacy Aladin credentials were stored as a raw TTBKey string.
    }

    if (provider === ALADIN_PROVIDER) {
      return {
        ttbKey: rawValue,
      };
    }

    return null;
  }

  private addSearchDiagnostic(
    diagnostics: ImportSearchDiagnostics,
    provider: ImportProvider,
    input: {
      configured: boolean;
      message: string;
      reasonCode: ImportSearchDiagnosticReasonCode | null;
      resultCount: number;
      status: ImportSearchDiagnosticStatus;
    },
  ) {
    addProviderDiagnostic(diagnostics, {
      configured: input.configured,
      credentialMode: PROVIDERS[provider].credentialMode,
      message: input.message,
      provider,
      reasonCode: input.reasonCode,
      resultCount: input.resultCount,
      status: input.status,
    });
  }

  private async fetchJson(
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
      timeoutMs?: number;
    },
  ) {
    const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
    const cachedResponse = this.readCachedProviderResponse(options.cacheKey);

    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    if (options.queryApiKey) {
      url.searchParams.set('api_key', options.queryApiKey);
    }

    const headers: Record<string, string> = {
      accept: options.accept,
      ...options.headers,
    };

    if (options.contentType) {
      headers['content-type'] = options.contentType;
    }

    if (options.bearerToken) {
      headers.authorization = `${options.bearerPrefix ?? 'Bearer'} ${options.bearerToken}`;
    }

    let response: Response;

    try {
      const abortController = new AbortController();
      const timeout = setTimeout(
        () => abortController.abort(),
        options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
      );
      const requestInit: RequestInit = {
        headers,
        method: options.method ?? 'GET',
        signal: abortController.signal,
      };

      if (options.body !== undefined) {
        requestInit.body = options.body;
      }

      try {
        response = await fetch(url, requestInit);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      throw new BadGatewayException(
        'Import provider is temporarily unavailable.',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ForbiddenException(
        'Import provider credentials were rejected.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Import provider returned an upstream error.',
      );
    }

    try {
      const responseBody = await response.json();

      this.writeCachedProviderResponse(
        options.cacheKey,
        responseBody,
        options.cacheTtlMs,
      );

      return responseBody;
    } catch {
      throw new BadGatewayException(
        'Import provider returned an unreadable response.',
      );
    }
  }

  private getProviderCacheKey(input: {
    limit: number;
    mediumType: WorkType | undefined;
    provider: ImportProvider;
    query: string;
    userScope?: string | null;
    variant?: string;
  }) {
    return [
      input.provider,
      input.mediumType ?? 'all',
      input.limit.toString(),
      input.userScope ?? 'public',
      (input.variant ?? '').trim().toLowerCase(),
      input.query.normalize('NFKC').trim().toLowerCase(),
    ].join(':');
  }

  private readCachedProviderResponse(cacheKey: string | undefined) {
    if (!cacheKey) {
      return undefined;
    }

    const cached = this.providerResponseCache.get(cacheKey);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.providerResponseCache.delete(cacheKey);
      return undefined;
    }

    return cached.value;
  }

  private writeCachedProviderResponse(
    cacheKey: string | undefined,
    value: unknown,
    ttlMs = PROVIDER_CACHE_TTL_MS,
  ) {
    if (!cacheKey || ttlMs <= 0) {
      return;
    }

    this.providerResponseCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  private mapBookWorkType(categoryName: string, title = '') {
    const searchable = `${categoryName} ${title}`;

    if (
      searchable.includes('라이트노벨') ||
      searchable.includes('라이트 노벨')
    ) {
      return WorkType.light_novel;
    }

    if (
      searchable.includes('만화') ||
      searchable.toLowerCase().includes('manga') ||
      searchable.toLowerCase().includes('comic')
    ) {
      return WorkType.manga;
    }

    if (
      searchable.includes('소설') ||
      searchable.toLowerCase().includes('novel')
    ) {
      return WorkType.novel;
    }

    return WorkType.novel;
  }

  private getFormatLabel(type: WorkType) {
    switch (type) {
      case WorkType.light_novel:
        return '라이트노벨';
      case WorkType.novel:
        return '소설';
      case WorkType.manga:
        return '만화';
      case WorkType.anime:
        return '애니';
      case WorkType.movie:
        return '영화';
      case WorkType.drama:
        return '드라마';
      case WorkType.web_novel:
        return '웹소설';
      case WorkType.webtoon:
        return '웹툰';
      default:
        return '기타';
    }
  }

  private toGenresText(categoryName: string) {
    const parts = categoryName
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
    const meaningfulParts = parts.length > 1 ? parts.slice(1) : parts;

    return meaningfulParts.slice(-3).join(', ');
  }

  private toContributorList(author?: string) {
    return (author ?? '')
      .split(/[,;/]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((name) => ({
        name,
        role: 'author',
      }));
  }

  private normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private stripHtml(value: string) {
    return stripHtml(value)
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  }

  private buildBookReleaseCandidates(input: {
    externalId?: string;
    isbn?: string | null;
    provider: string;
    releaseDate?: string | null;
    sequence?: number | null;
    thumbnailUrl?: string;
    title: string;
    url?: string;
  }): CatalogReleaseCandidateInput[] {
    const title = this.normalizeWhitespace(input.title);

    if (!title) {
      return [];
    }

    const sequence = input.sequence ?? this.extractVolumeSequence(title);
    const isbn = normalizeIsbn(input.isbn ?? null);
    const externalId = input.externalId?.trim() ?? '';
    const externalRefs: CatalogExternalRefInput[] = externalId
      ? [
          {
            externalId,
            provider: input.provider,
            rawType: 'volume',
            url: input.url?.trim() ?? '',
          },
        ]
      : [];

    if (externalRefs.length === 0 && !isbn && sequence === null) {
      return [];
    }

    return [
      {
        displayLabel: sequence !== null ? `Vol. ${sequence}` : title,
        externalRefs,
        isbn,
        releaseDate: normalizeReleaseDate(input.releaseDate ?? null),
        releaseType: 'volume',
        sequence,
        thumbnailUrl: input.thumbnailUrl?.trim() ?? '',
        title,
      },
    ];
  }

  private extractPrimaryIsbn(value: string | null) {
    return normalizeIsbn(this.readString(value));
  }

  private readGoogleBooksIsbn(value: unknown) {
    const identifiers = Array.isArray(value) ? value : [];
    const isbn13 = identifiers.find((entry) => {
      return (
        this.isRecord(entry) &&
        this.readString(entry.type).toUpperCase() === 'ISBN_13'
      );
    });

    if (this.isRecord(isbn13)) {
      return this.extractPrimaryIsbn(this.readString(isbn13.identifier));
    }

    const isbn10 = identifiers.find((entry) => {
      return (
        this.isRecord(entry) &&
        this.readString(entry.type).toUpperCase() === 'ISBN_10'
      );
    });

    if (this.isRecord(isbn10)) {
      return this.extractPrimaryIsbn(this.readString(isbn10.identifier));
    }

    const fallback = identifiers.find((entry) => this.isRecord(entry));

    return this.isRecord(fallback)
      ? this.extractPrimaryIsbn(this.readString(fallback.identifier))
      : null;
  }

  private readOpenLibraryIsbn(value: unknown) {
    const isbns = this.readStringArray(value);

    for (const isbn of isbns) {
      const normalized = this.extractPrimaryIsbn(isbn);

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private extractVolumeSequence(title: string) {
    const patterns = [
      /(?:vol(?:ume)?\.?\s*|#)\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:권|巻|册|冊)/u,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);

      if (!match?.[1]) {
        continue;
      }

      const sequence = Number.parseFloat(match[1]);

      if (Number.isFinite(sequence)) {
        return sequence;
      }
    }

    return null;
  }

  private parseYear(value: string) {
    return parseNormalizedReleaseYear(value);
  }

  private readString(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return '';
  }

  private readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.map((entry) => this.readString(entry)).filter(Boolean)
      : [];
  }

  private readPathArray(value: unknown, path: string[]) {
    const resolved = this.readPath(value, path);

    return Array.isArray(resolved) ? resolved : [];
  }

  private readPathNumber(value: unknown, path: string[]) {
    return this.readNumber(this.readPath(value, path));
  }

  private readPath(value: unknown, path: string[]) {
    return path.reduce<unknown>((current, key) => {
      return this.isRecord(current) ? current[key] : undefined;
    }, value);
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.name : 'UnknownError';
  }

  private logSearchSummary(
    userId: string | null,
    provider: string,
    query: string,
    resultCount: number,
    status: string,
  ) {
    this.logger.log(
      `Import search summary userId=${userId ?? 'guest'} provider=${provider} queryLength=${query.length} resultCount=${resultCount} status=${status}`,
    );
  }
}
