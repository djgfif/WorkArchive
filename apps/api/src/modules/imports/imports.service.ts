import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';

import {
  CatalogIngestionService,
  type CatalogExternalRefInput,
  type CatalogReleaseCandidateInput,
} from '../catalog/catalog-ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from '../../observability/metrics.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type {
  ImportProviderKeyTestFailureReason,
  ImportProviderKeyTestResponseDto,
} from './dto/import-provider-key-test-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { mergeImportCandidates } from './import-candidate-merge';
import {
  normalizeImportCandidate,
  normalizeImportTitleSignal,
  normalizeIsbn,
  normalizeReleaseDate,
  parseNormalizedReleaseYear,
  stripHtml,
} from './import-candidate-normalization';
import { rankImportCandidates } from './import-candidate-ranking';
import {
  PROVIDERS,
  type ProviderCredentialValues,
  type ProviderMetadata,
  type ProviderSearchContext,
} from './import-provider-adapter';
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
  NAVER_WEB_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TMDB_PROVIDER,
  BRAVE_SEARCH_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  TVMAZE_PROVIDER,
  KAKAO_WEB_PROVIDER,
  WIKIDATA_PROVIDER,
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
const NAVER_WEB_SEARCH_URL = 'https://openapi.naver.com/v1/search/webkr.json';
const KAKAO_WEB_SEARCH_URL = 'https://dapi.kakao.com/v2/search/web';
const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
// KOBIS still publishes this Open API over HTTP. The API key is user-scoped,
// sent as a query parameter, and never exposed to guests; see the provider
// hardening runbook before enabling it in production networks.
const KOBIS_MOVIE_SEARCH_URL =
  'http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_USER_AGENT =
  'WorkArchive/1.0 (Wikidata enrichment provider; local-first personal archive)';
const ALADIN_ATTRIBUTION = '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)';
const DEFAULT_LIMIT = 10;
const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;
const MAX_LIMIT = 20;
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1_000;
const PROVIDER_CIRCUIT_FAILURE_THRESHOLD = 3;
const PROVIDER_CIRCUIT_OPEN_MS = 60_000;
const WEB_SERIAL_INCLUDE_DOMAINS = [
  'series.naver.com',
  'comic.naver.com',
  'page.kakao.com',
  'webtoon.kakao.com',
  'ridibooks.com',
  'munpia.com',
  'novelpia.com',
  'joara.com',
] as const;

type UnknownRecord = Record<string, unknown>;

const WIKIDATA_CLAIM_MAPPINGS = {
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

const WIKIDATA_WORK_TYPE_QIDS: Partial<Record<WorkType, string[]>> = {
  [WorkType.anime]: ['Q1107', 'Q63952888', 'Q20650540'],
  [WorkType.drama]: ['Q5398426', 'Q15416', 'Q1259759'],
  [WorkType.light_novel]: ['Q747381'],
  [WorkType.manga]: ['Q8274', 'Q21198342'],
  [WorkType.movie]: ['Q11424'],
  [WorkType.novel]: ['Q8261', 'Q571', 'Q7725634'],
  [WorkType.web_novel]: ['Q7725634', 'Q8261'],
  [WorkType.webtoon]: ['Q20442589', 'Q8274', 'Q1004'],
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
  // TODO: Move provider circuit state to Redis if this API runs multiple instances.
  private readonly providerCircuitState = new Map<
    ImportProvider,
    {
      consecutiveFailures: number;
      openedUntil: number | null;
      reasonCode: 'provider_failed';
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
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
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
          ...this.getProviderCircuitStatus(provider),
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

  async testProviderKey(
    userId: string,
    providerInput: string,
  ): Promise<ImportProviderKeyTestResponseDto> {
    const provider = this.assertUserCredentialProvider(providerInput);
    const checkedAt = new Date().toISOString();
    const credentials = await this.getProviderCredentialValues(userId, provider);

    if (!credentials) {
      return this.buildProviderKeyTestResponse({
        checkedAt,
        message: `${PROVIDERS[provider].label} API key is not configured.`,
        ok: false,
        provider,
        reason: 'missing_key',
      });
    }

    try {
      await this.runProviderKeyTest(provider, credentials);

      return this.buildProviderKeyTestResponse({
        checkedAt,
        message: `${PROVIDERS[provider].label} API key connection test succeeded.`,
        ok: true,
        provider,
        reason: null,
      });
    } catch (error) {
      const reason = this.classifyProviderKeyTestFailure(error);

      return this.buildProviderKeyTestResponse({
        checkedAt,
        message: this.getProviderKeyTestFailureMessage(provider, reason),
        ok: false,
        provider,
        reason,
      });
    }
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

      if (this.isProviderCircuitOpen(provider)) {
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search is temporarily skipped after repeated failures.`,
          reasonCode: 'circuit_open',
          resultCount: 0,
          status: 'skipped',
        });
        continue;
      }

      const providerStartedAt = Date.now();

      try {
        const context: ProviderSearchContext = {
          limit,
          query,
          userId,
        };

        if (mediumType !== undefined) {
          context.mediumType = mediumType;
        }

        const providerCandidates = await this.searchProviderWithFallback(
          provider,
          context,
        );

        candidates.push(...providerCandidates);
        this.recordProviderSuccess(provider);
        this.addSearchDiagnostic(diagnostics, provider, {
          configured,
          message: `${PROVIDERS[provider].label} search completed.`,
          reasonCode: null,
          resultCount: providerCandidates.length,
          status: 'searched',
        });
      } catch (error) {
        this.recordProviderFailure(provider);
        this.metricsService?.recordImportsProviderFailure(
          provider,
          this.describeError(error),
        );
        if (explicitSingleProvider) {
          throw error;
        }

        failures.push(`${provider}:${this.describeError(error)}`);
        this.logEvent('imports.provider.failed', {
          durationMs: Date.now() - providerStartedAt,
          errorCode: this.describeError(error),
          provider,
          userId: userId ?? undefined,
        });
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

  private isProviderCircuitOpen(provider: ImportProvider) {
    const state = this.providerCircuitState.get(provider);

    if (!state?.openedUntil) {
      return false;
    }

    if (Date.now() < state.openedUntil) {
      return true;
    }

    this.providerCircuitState.set(provider, {
      consecutiveFailures: 0,
      openedUntil: null,
      reasonCode: 'provider_failed',
    });

    return false;
  }

  private getProviderCircuitStatus(provider: ImportProvider) {
    const state = this.providerCircuitState.get(provider);

    if (!state?.openedUntil || Date.now() >= state.openedUntil) {
      return {
        circuitOpenedUntil: null,
        circuitReasonCode: null,
        circuitState: 'closed' as const,
      };
    }

    return {
      circuitOpenedUntil: new Date(state.openedUntil).toISOString(),
      circuitReasonCode: state.reasonCode,
      circuitState: 'open' as const,
    };
  }

  private recordProviderSuccess(provider: ImportProvider) {
    this.providerCircuitState.delete(provider);
  }

  private recordProviderFailure(provider: ImportProvider) {
    const current = this.providerCircuitState.get(provider) ?? {
      consecutiveFailures: 0,
      openedUntil: null,
      reasonCode: 'provider_failed' as const,
    };
    const consecutiveFailures = current.consecutiveFailures + 1;

    const openedUntil =
      consecutiveFailures >= PROVIDER_CIRCUIT_FAILURE_THRESHOLD
        ? Date.now() + PROVIDER_CIRCUIT_OPEN_MS
        : null;

    this.providerCircuitState.set(provider, {
      consecutiveFailures,
      openedUntil,
      reasonCode: 'provider_failed',
    });

    if (openedUntil && !current.openedUntil) {
      this.metricsService?.recordImportsProviderCircuitOpen(
        provider,
        'provider_failed',
      );
    }
  }

  private logEvent(
    event: string,
    fields: {
      count?: number;
      durationMs?: number;
      entityType?: string;
      errorCode?: string;
      provider?: string;
      requestId?: string;
      userId?: string | undefined;
    },
  ) {
    this.logger.warn(
      JSON.stringify({
        count: fields.count ?? null,
        durationMs: fields.durationMs ?? null,
        entityType: fields.entityType ?? null,
        errorCode: fields.errorCode ?? null,
        event,
        provider: fields.provider ?? null,
        requestId: fields.requestId ?? null,
        userId: fields.userId ?? null,
      }),
    );
  }

  async resolveCandidate(
    userId: string | null,
    candidateInput: unknown,
  ): Promise<ImportCandidateResponseDto> {
    if (!this.isRecord(candidateInput)) {
      throw new BadRequestException('Import candidate payload must be an object.');
    }

    const type = this.readCandidateWorkType(
      candidateInput.mediumType ?? candidateInput.type,
    );
    const title = this.normalizeWhitespace(this.readString(candidateInput.title));

    if (!title) {
      throw new BadRequestException('Import candidate title is required.');
    }

    const sourceId =
      this.normalizeWhitespace(
        this.readString(candidateInput.sourceId ?? candidateInput.provider),
      ) || MANUAL_PROVIDER;
    const externalId =
      this.normalizeWhitespace(this.readString(candidateInput.externalId)) ||
      `${sourceId}:${title}`;
    const externalRefs = this.readCandidateExternalRefs(
      candidateInput.externalRefs,
    );

    const normalized = normalizeImportCandidate({
      author: this.readString(candidateInput.author),
      catalogMatch: null,
      confidence: this.readNumber(candidateInput.confidence) ?? 0.5,
      confidenceLabel: this.readString(candidateInput.confidenceLabel),
      contributors: this.readCandidateContributors(candidateInput.contributors),
      countLabel: this.readString(candidateInput.countLabel),
      description: this.readString(candidateInput.description),
      existingRecord: null,
      externalId,
      externalRefs:
        externalRefs.length > 0
          ? externalRefs
          : [
              {
                externalId,
                provider: sourceId,
                rawType: type,
                url: this.readString(candidateInput.sourceUrl),
              },
            ],
      formatLabel:
        this.readString(candidateInput.formatLabel) || this.getFormatLabel(type),
      franchiseName:
        this.normalizeWhitespace(this.readString(candidateInput.franchiseName)) ||
        null,
      genresText: this.readString(candidateInput.genresText),
      id: this.readString(candidateInput.id) || `${sourceId}:${externalId}`,
      mediumType: type,
      note: this.readString(candidateInput.note),
      reason: this.readString(candidateInput.reason),
      relationsHint: this.readCandidateRelations(candidateInput.relationsHint),
      releaseCandidates: this.readCandidateReleases(
        candidateInput.releaseCandidates,
      ),
      releaseYear:
        this.readNumber(candidateInput.releaseYear) ??
        this.parseYear(this.readString(candidateInput.releaseDate)),
      scoreBreakdown: this.readCandidateScoreBreakdown(
        candidateInput.scoreBreakdown,
      ),
      sourceCoverage: {
        externalIdentityCount: 0,
        providerCount: 0,
        providers: [],
        releaseCandidateCount: 0,
      },
      sourceId,
      sourceLabel:
        this.readString(candidateInput.sourceLabel) ||
        this.getCandidateSourceLabel(sourceId),
      sourceUrl: this.readString(candidateInput.sourceUrl),
      subType:
        this.normalizeWhitespace(this.readString(candidateInput.subType)) || null,
      thumbnailUrl: this.readString(candidateInput.thumbnailUrl),
      title,
      titleAliases: this.readStringArray(candidateInput.titleAliases),
      type,
    });
    const [decorated] = await this.decorateCandidates(userId, [normalized]);

    return decorated ?? normalized;
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

  private supportsMedium(provider: ImportProvider, mediumType?: WorkType) {
    return !mediumType || PROVIDERS[provider].mediumTypes.includes(mediumType);
  }

  private matchesProviderResultMedium(
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

  private resolveSearchProviders(
    providers: ImportProvider[],
    searchQuery: ImportSearchQueryDto,
    userId: string | null,
  ) {
    if (userId) {
      return providers;
    }

    const allowedProviders = providers.filter((provider) => {
      const credentialMode = PROVIDERS[provider].credentialMode;

      return (
        credentialMode === 'none' ||
        (credentialMode === 'server' && this.isServerSearchGuestEnabled())
      );
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

    if (metadata.credentialMode === 'server') {
      return Boolean(this.getServerProviderApiKey(provider));
    }

    if (!userId) {
      return false;
    }

    if (provider === NAVER_WEB_PROVIDER) {
      return (
        (await this.credentialService.hasCredential(
          userId,
          NAVER_WEB_PROVIDER,
        )) || this.credentialService.hasCredential(userId, NAVER_BOOK_PROVIDER)
      );
    }

    if (provider === KAKAO_WEB_PROVIDER) {
      return (
        (await this.credentialService.hasCredential(
          userId,
          KAKAO_WEB_PROVIDER,
        )) || this.credentialService.hasCredential(userId, KAKAO_BOOK_PROVIDER)
      );
    }

    if (metadata.credentialMode === 'user') {
      return this.credentialService.hasCredential(userId, provider);
    }

    return false;
  }

  private buildProviderKeyTestResponse(input: {
    checkedAt: string;
    message: string;
    ok: boolean;
    provider: ImportProvider;
    reason: ImportProviderKeyTestFailureReason | null;
  }): ImportProviderKeyTestResponseDto {
    return {
      checkedAt: input.checkedAt,
      message: input.message,
      ok: input.ok,
      provider: input.provider,
      reason: input.reason,
    };
  }

  private async runProviderKeyTest(
    provider: ImportProvider,
    credentials: ProviderCredentialValues,
  ) {
    switch (provider) {
      case ALADIN_PROVIDER:
        return this.testAladinProviderKey(credentials);
      case NAVER_BOOK_PROVIDER:
        return this.testNaverProviderKey(credentials, NAVER_BOOK_SEARCH_URL);
      case NAVER_WEB_PROVIDER:
        return this.testNaverProviderKey(credentials, NAVER_WEB_SEARCH_URL);
      case KAKAO_BOOK_PROVIDER:
        return this.testKakaoProviderKey(credentials, KAKAO_BOOK_SEARCH_URL);
      case KAKAO_WEB_PROVIDER:
        return this.testKakaoProviderKey(credentials, KAKAO_WEB_SEARCH_URL);
      case TMDB_PROVIDER:
        return this.testTmdbProviderKey(credentials);
      case BRAVE_SEARCH_PROVIDER:
        return this.testBraveProviderKey(credentials);
      case TAVILY_SEARCH_PROVIDER:
        return this.testTavilyProviderKey(credentials);
      case KOBIS_PROVIDER:
        return this.testKobisProviderKey(credentials);
      default:
        throw new BadRequestException('Unsupported provider key test.');
    }
  }

  private async testAladinProviderKey(credentials: ProviderCredentialValues) {
    const ttbKey = credentials.ttbKey;

    if (!ttbKey) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(ALADIN_ITEM_SEARCH_URL);

    searchUrl.searchParams.set('ttbkey', ttbKey);
    searchUrl.searchParams.set('Query', '해리포터');
    searchUrl.searchParams.set('QueryType', 'Keyword');
    searchUrl.searchParams.set('SearchTarget', 'Book');
    searchUrl.searchParams.set('output', 'JS');
    searchUrl.searchParams.set('Version', '20131101');
    searchUrl.searchParams.set('MaxResults', '1');
    searchUrl.searchParams.set('start', '1');

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });

    if (
      this.isRecord(responseBody) &&
      (responseBody.errorCode || responseBody.errorMessage)
    ) {
      throw new ForbiddenException('Provider API key was rejected.');
    }
  }

  private async testNaverProviderKey(
    credentials: ProviderCredentialValues,
    rawUrl: string,
  ) {
    const clientId = credentials.clientId;
    const clientSecret = credentials.clientSecret;

    if (!clientId || !clientSecret) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(rawUrl);

    searchUrl.searchParams.set('query', '해리포터');
    searchUrl.searchParams.set('display', '1');

    await this.fetchJson(searchUrl, {
      accept: 'application/json',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private async testKakaoProviderKey(
    credentials: ProviderCredentialValues,
    rawUrl: string,
  ) {
    const restApiKey = credentials.restApiKey;

    if (!restApiKey) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(rawUrl);

    searchUrl.searchParams.set('query', '해리포터');
    searchUrl.searchParams.set('size', '1');

    await this.fetchJson(searchUrl, {
      accept: 'application/json',
      bearerPrefix: 'KakaoAK',
      bearerToken: restApiKey,
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private async testTmdbProviderKey(credentials: ProviderCredentialValues) {
    const readToken = credentials.readToken;

    if (!readToken) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(TMDB_SEARCH_MOVIE_URL);

    searchUrl.searchParams.set('query', 'inception');
    searchUrl.searchParams.set('include_adult', 'false');
    searchUrl.searchParams.set('language', 'ko-KR');

    await this.fetchJson(searchUrl, {
      accept: 'application/json',
      bearerToken: readToken,
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private async testKobisProviderKey(credentials: ProviderCredentialValues) {
    const apiKey = credentials.apiKey;

    if (!apiKey) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(KOBIS_MOVIE_SEARCH_URL);

    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('movieNm', 'inception');
    searchUrl.searchParams.set('itemPerPage', '1');

    await this.fetchJson(searchUrl, {
      accept: 'application/json',
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private async testBraveProviderKey(credentials: ProviderCredentialValues) {
    const apiKey = credentials.apiKey;

    if (!apiKey) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    const searchUrl = new URL(BRAVE_SEARCH_URL);

    searchUrl.searchParams.set('q', 'test');
    searchUrl.searchParams.set('count', '1');

    await this.fetchJson(searchUrl, {
      accept: 'application/json',
      headers: {
        'X-Subscription-Token': apiKey,
      },
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private async testTavilyProviderKey(credentials: ProviderCredentialValues) {
    const apiKey = credentials.apiKey;

    if (!apiKey) {
      throw new ForbiddenException('Provider API key is missing.');
    }

    await this.fetchJson(TAVILY_SEARCH_URL, {
      accept: 'application/json',
      bearerToken: apiKey,
      body: JSON.stringify({
        include_raw_content: false,
        max_results: 1,
        query: 'test',
        search_depth: 'basic',
      }),
      contentType: 'application/json',
      method: 'POST',
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });
  }

  private classifyProviderKeyTestFailure(
    error: unknown,
  ): ImportProviderKeyTestFailureReason {
    if (error instanceof ForbiddenException) {
      return 'unauthorized';
    }

    if (error instanceof BadGatewayException) {
      return 'provider_unavailable';
    }

    return 'unknown';
  }

  private getProviderKeyTestFailureMessage(
    provider: ImportProvider,
    reason: ImportProviderKeyTestFailureReason,
  ) {
    const label = PROVIDERS[provider].label;

    switch (reason) {
      case 'missing_key':
        return `${label} API key is not configured.`;
      case 'unauthorized':
        return `${label} API key was rejected by the provider.`;
      case 'provider_unavailable':
        return `${label} provider is temporarily unavailable.`;
      case 'unknown':
      default:
        return `${label} API key connection test failed.`;
    }
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
      case BRAVE_SEARCH_PROVIDER:
        return this.searchBrave(context);
      case TAVILY_SEARCH_PROVIDER:
        return this.searchTavily(context);
      case NAVER_WEB_PROVIDER:
        return this.searchNaverWeb(context);
      case KAKAO_WEB_PROVIDER:
        return this.searchKakaoWeb(context);
      case KOBIS_PROVIDER:
        return this.searchKobis(context);
      case WIKIDATA_PROVIDER:
        return this.searchWikidata(context);
      case MANUAL_PROVIDER:
        return this.searchManual(context);
    }
  }

  private async searchProviderWithFallback(
    provider: ImportProvider,
    context: ProviderSearchContext,
  ) {
    const variants =
      provider === MANUAL_PROVIDER
        ? [context.query]
        : this.getProviderSearchQueryVariants(context.query);
    const candidates: ImportCandidateResponseDto[] = [];

    for (const [index, query] of variants.entries()) {
      try {
        const providerCandidates = await this.searchProvider(provider, {
          ...context,
          query,
        });

        candidates.push(...providerCandidates);

        if (
          index === 0 &&
          !this.shouldTrySearchFallback(providerCandidates, context.query)
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

  private getProviderSearchQueryVariants(query: string) {
    const normalized = this.normalizeProviderSearchQuery(query);
    const withoutBracketSuffix = this.normalizeProviderSearchQuery(
      normalized.replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, ''),
    );
    const withoutVolumeSuffix = this.normalizeProviderSearchQuery(
      withoutBracketSuffix.replace(
        /\s*(?:(?:vol(?:ume)?\.?|book|시즌|season)\s*\d+|\d+\s*(?:권|화|회|장|부))\s*$/iu,
        '',
      ),
    );
    const withoutNumericSuffix = this.normalizeProviderSearchQuery(
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

  private normalizeProviderSearchQuery(query: string) {
    return query.normalize('NFKC').trim().replace(/\s+/g, ' ');
  }

  private shouldTrySearchFallback(
    candidates: ImportCandidateResponseDto[],
    query: string,
  ) {
    return (
      candidates.length === 0 ||
      !candidates.some((candidate) =>
        this.hasStrongTitleSignal(candidate, query),
      )
    );
  }

  private hasStrongTitleSignal(
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
          this.matchesProviderResultMedium(candidate, mediumType)
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
          this.matchesProviderResultMedium(candidate, mediumType)
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
          this.matchesProviderResultMedium(candidate, mediumType)
        );
      });
  }

  private async searchBrave({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    if (!userId) {
      throw new UnauthorizedException(
        'Brave Search requires a signed-in account.',
      );
    }

    const credentials = await this.getProviderCredentialValues(
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
    const rewrittenQuery = this.buildGeneralWebSearchQuery(query, mediumType);

    searchUrl.searchParams.set('q', rewrittenQuery);
    searchUrl.searchParams.set('count', Math.min(limit, 20).toString());
    searchUrl.searchParams.set('country', 'kr');
    searchUrl.searchParams.set('search_lang', 'ko');

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
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
    const results = this.readPathArray(responseBody, ['web', 'results']);

    return results
      .map((item, index) => this.mapBraveSearchItem(item, index, mediumType))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchTavily({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    if (!userId) {
      throw new UnauthorizedException(
        'Tavily Search requires a signed-in account.',
      );
    }

    const credentials = await this.getProviderCredentialValues(
      userId,
      TAVILY_SEARCH_PROVIDER,
    );
    const apiKey = credentials?.apiKey;

    if (!apiKey) {
      throw new ForbiddenException(
        'Tavily API key is not configured for this user.',
      );
    }

    const rewrittenQuery = this.buildGeneralWebSearchQuery(query, mediumType);
    const responseBody = await this.fetchJson(TAVILY_SEARCH_URL, {
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
      cacheKey: this.getProviderCacheKey({
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
    const results = this.readPathArray(responseBody, ['results']);

    return results
      .map((item, index) => this.mapTavilySearchItem(item, index, mediumType))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchNaverWeb({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValuesWithFallback(
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
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
    const items = this.readPathArray(responseBody, ['items']);

    return items
      .map((item, index) => this.mapNaverWebItem(item, index, mediumType))
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
  }

  private async searchKakaoWeb({
    limit,
    mediumType,
    query,
    userId,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const credential = userId
      ? await this.getProviderCredentialValuesWithFallback(
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

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      bearerPrefix: 'KakaoAK',
      bearerToken: restApiKey,
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: KAKAO_WEB_PROVIDER,
        query,
        userScope: userId,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    });
    const documents = this.readPathArray(responseBody, ['documents']);

    return documents
      .map((item, index) => this.mapKakaoWebItem(item, index, mediumType))
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

  private async searchWikidata({
    limit,
    mediumType,
    query,
  }: ProviderSearchContext): Promise<ImportCandidateResponseDto[]> {
    const searchUrl = new URL(WIKIDATA_API_URL);
    const language = this.getWikidataSearchLanguage(query);

    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('language', language);
    searchUrl.searchParams.set('uselang', language);
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('search', query);
    searchUrl.searchParams.set('limit', Math.min(limit, 10).toString());

    const responseBody = await this.fetchJson(searchUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
        limit,
        mediumType,
        provider: WIKIDATA_PROVIDER,
        query,
        variant: `search:${language}`,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
      headers: this.getWikidataHeaders(),
      retryAfterMaxMs: 1_000,
    });
    const qids = Array.from(
      new Set(
        this.readPathArray(responseBody, ['search'])
          .map((item) =>
            this.isRecord(item)
              ? this.readString(item.id) || this.readString(item.title)
              : '',
          )
          .filter((id) => /^Q\d+$/u.test(id)),
      ),
    ).slice(0, Math.min(limit, 10));

    if (qids.length === 0) {
      return [];
    }

    const entityMap = await this.fetchWikidataEntities({
      ids: qids,
      limit,
      mediumType,
      query,
      variant: 'primary',
    });
    const relatedIds = Array.from(
      new Set(
        [...entityMap.values()].flatMap((entity) =>
          this.readWikidataRelatedEntityIds(entity),
        ),
      ),
    ).slice(0, 50);
    const relatedEntityMap =
      relatedIds.length > 0
        ? await this.fetchWikidataEntities({
            ids: relatedIds,
            limit,
            mediumType,
            query,
            variant: 'related',
          })
        : new Map<string, UnknownRecord>();

    return qids
      .map((qid, index) =>
        this.mapWikidataEntity({
          entity: entityMap.get(qid),
          index,
          mediumType,
          query,
          relatedEntityMap,
        }),
      )
      .filter((candidate): candidate is ImportCandidateResponseDto => {
        return (
          candidate !== null &&
          (!mediumType || candidate.mediumType === mediumType)
        );
      });
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

  private mapBraveSearchItem(
    item: unknown,
    index: number,
    requestedMediumType?: WorkType,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    return this.buildExternalWebSearchCandidate({
      confidence: index === 0 ? 0.78 : 0.6,
      description: this.readString(item.description),
      idPrefix: BRAVE_SEARCH_PROVIDER,
      note: 'Brave Search API',
      provider: BRAVE_SEARCH_PROVIDER,
      reason: 'Brave 웹 검색 결과',
      requestedMediumType,
      sourceLabel: 'Brave Search',
      title: this.readString(item.title),
      url: this.readString(item.url),
    });
  }

  private mapTavilySearchItem(
    item: unknown,
    index: number,
    requestedMediumType?: WorkType,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    return this.buildExternalWebSearchCandidate({
      confidence: index === 0 ? 0.76 : 0.58,
      description: this.readString(item.content),
      idPrefix: TAVILY_SEARCH_PROVIDER,
      note: 'Tavily Search API',
      provider: TAVILY_SEARCH_PROVIDER,
      reason: 'Tavily 웹 검색 결과',
      requestedMediumType,
      sourceLabel: 'Tavily Search',
      title: this.readString(item.title),
      url: this.readString(item.url),
    });
  }

  private mapNaverWebItem(
    item: unknown,
    index: number,
    requestedMediumType?: WorkType,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const rawTitle = this.stripHtml(this.readString(item.title));
    const title = this.normalizeWebSearchTitle(rawTitle);
    const sourceUrl = this.readString(item.link);
    const description = this.normalizeWhitespace(
      this.stripHtml(this.readString(item.description)),
    );
    const type = this.inferWebSearchWorkType({
      description,
      requestedMediumType,
      title,
      url: sourceUrl,
    });

    if (!title || !type) {
      return null;
    }

    const externalId = sourceUrl || title;

    return this.buildCandidate({
      confidence: index === 0 ? 0.76 : 0.58,
      confidenceLabel: index === 0 ? 'Naver Web 상위' : 'Naver Web 후보',
      countLabel: this.getWebSourceLabel(sourceUrl) || 'Naver Web',
      description,
      externalId,
      formatLabel: this.getFormatLabel(type),
      id: `${NAVER_WEB_PROVIDER}:${externalId}`,
      note: 'Naver Search Web API',
      provider: NAVER_WEB_PROVIDER,
      reason: 'Naver 웹문서 검색 결과',
      sourceLabel: 'Naver Web',
      sourceUrl,
      title,
      titleAliases: [rawTitle, title].filter(Boolean),
      type,
    });
  }

  private mapKakaoWebItem(
    item: unknown,
    index: number,
    requestedMediumType?: WorkType,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const rawTitle = this.stripHtml(this.readString(item.title));
    const title = this.normalizeWebSearchTitle(rawTitle);
    const sourceUrl = this.readString(item.url);
    const description = this.normalizeWhitespace(
      this.stripHtml(this.readString(item.contents)),
    );
    const type = this.inferWebSearchWorkType({
      description,
      requestedMediumType,
      title,
      url: sourceUrl,
    });

    if (!title || !type) {
      return null;
    }

    const externalId = sourceUrl || title;

    return this.buildCandidate({
      confidence: index === 0 ? 0.76 : 0.58,
      confidenceLabel: index === 0 ? 'Kakao Web 상위' : 'Kakao Web 후보',
      countLabel:
        [
          this.getWebSourceLabel(sourceUrl),
          this.readString(item.datetime).slice(0, 10),
        ]
          .filter(Boolean)
          .join(' · ') || 'Kakao Web',
      description,
      externalId,
      formatLabel: this.getFormatLabel(type),
      id: `${KAKAO_WEB_PROVIDER}:${externalId}`,
      note: 'Kakao Daum Web Search API',
      provider: KAKAO_WEB_PROVIDER,
      reason: 'Kakao 웹문서 검색 결과',
      releaseYear: this.parseYear(this.readString(item.datetime)),
      sourceLabel: 'Kakao Web',
      sourceUrl,
      title,
      titleAliases: [rawTitle, title].filter(Boolean),
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

  private mapWikidataEntity({
    entity,
    index,
    mediumType,
    query,
    relatedEntityMap,
  }: {
    entity: UnknownRecord | undefined;
    index: number;
    mediumType: WorkType | undefined;
    query: string;
    relatedEntityMap: Map<string, UnknownRecord>;
  }): ImportCandidateResponseDto | null {
    if (!entity) {
      return null;
    }

    const qid = this.readString(entity.id);

    if (!/^Q\d+$/u.test(qid)) {
      return null;
    }

    const labels = this.readWikidataMultilingualValues(entity.labels);
    const aliases = this.readWikidataAliases(entity.aliases);
    const title = labels[0] ?? aliases[0] ?? qid;

    if (!title) {
      return null;
    }

    const type = mediumType ?? this.inferWikidataWorkType(entity);
    const sourceUrl = `https://www.wikidata.org/wiki/${qid}`;
    const wikipediaUrl = this.readWikidataSitelinkUrl(entity.sitelinks);
    const externalRefs = this.dedupeRawExternalRefs([
      {
        externalId: qid,
        provider: WIKIDATA_PROVIDER,
        rawType: 'entity',
        url: sourceUrl,
      },
      ...(wikipediaUrl
        ? [
            {
              externalId: wikipediaUrl,
              provider: 'wikipedia',
              rawType: 'article',
              url: wikipediaUrl,
            },
          ]
        : []),
      ...this.readWikidataExternalRefs(entity),
    ]);
    const franchiseName = this.readWikidataRelatedLabel(
      entity,
      WIKIDATA_CLAIM_MAPPINGS.franchise,
      relatedEntityMap,
    );
    const relationsHint = this.readWikidataRelations(
      entity,
      relatedEntityMap,
    );
    const releaseYear = this.readWikidataReleaseYear(entity);
    const confidence = this.calculateWikidataConfidence({
      aliases: [...labels, ...aliases],
      index,
      query,
      title,
    });
    const isbns = this.readWikidataIsbns(entity);

    return this.buildCandidate({
      confidence,
      confidenceLabel:
        confidence >= 0.72
          ? 'Wikidata 상위'
          : confidence >= 0.58
            ? 'Wikidata 후보'
            : 'Wikidata 검토 필요',
      contributors: this.readWikidataContributors(entity, relatedEntityMap),
      countLabel: releaseYear ? `${releaseYear}` : 'Wikidata entity',
      description: this.readWikidataMultilingualValues(entity.descriptions)[0] ?? '',
      externalId: qid,
      externalRefs,
      formatLabel: this.getFormatLabel(type),
      franchiseName,
      id: `${WIKIDATA_PROVIDER}:${qid}`,
      note: 'Wikidata/Wikimedia public data',
      provider: WIKIDATA_PROVIDER,
      relationsHint,
      releaseCandidates: isbns.map((isbn) => ({
        displayLabel: title,
        externalRefs: [
          {
            externalId: qid,
            provider: WIKIDATA_PROVIDER,
            rawType: 'entity',
            url: sourceUrl,
          },
        ],
        isbn,
        releaseDate: null,
        releaseType: 'edition',
        sequence: null,
        thumbnailUrl: this.readWikidataThumbnailUrl(entity),
        title,
      })),
      reason: this.getWikidataReason(query, title, [...labels, ...aliases]),
      releaseYear,
      sourceLabel: 'Wikidata',
      sourceUrl,
      thumbnailUrl: this.readWikidataThumbnailUrl(entity),
      title,
      titleAliases: [...labels, ...aliases],
      type,
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

  private buildExternalWebSearchCandidate(input: {
    confidence: number;
    description: string;
    idPrefix: ImportProvider;
    note: string;
    provider: ImportProvider;
    reason: string;
    requestedMediumType: WorkType | undefined;
    sourceLabel: string;
    title: string;
    url: string;
  }) {
    const rawTitle = this.stripHtml(input.title);
    const title = this.normalizeWebSearchTitle(rawTitle);
    const sourceUrl = input.url.trim();
    const description = this.normalizeWhitespace(
      this.stripHtml(input.description),
    );
    const type = this.inferWebSearchWorkType({
      description,
      requestedMediumType: input.requestedMediumType,
      title,
      url: sourceUrl,
    });

    if (!title || !type || !sourceUrl) {
      return null;
    }

    const sourceLabel = this.getWebSourceLabel(sourceUrl) || input.sourceLabel;

    return this.buildCandidate({
      confidence: input.confidence,
      confidenceLabel:
        input.confidence >= 0.76
          ? `${input.sourceLabel} 상위`
          : `${input.sourceLabel} 후보`,
      countLabel: sourceLabel,
      description,
      externalId: sourceUrl,
      formatLabel: this.getFormatLabel(type),
      id: `${input.idPrefix}:${sourceUrl}`,
      note: input.note,
      provider: input.provider,
      reason: input.reason,
      sourceLabel: input.sourceLabel,
      sourceUrl,
      title,
      titleAliases: [rawTitle, title].filter(Boolean),
      type,
    });
  }

  private async fetchWikidataEntities(input: {
    ids: string[];
    limit: number;
    mediumType: WorkType | undefined;
    query: string;
    variant: string;
  }) {
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

    const responseBody = await this.fetchJson(entityUrl, {
      accept: 'application/json',
      cacheKey: this.getProviderCacheKey({
        limit: input.limit,
        mediumType: input.mediumType,
        provider: WIKIDATA_PROVIDER,
        query: input.query,
        variant: `entities:${input.variant}:${ids.join(',')}`,
      }),
      cacheTtlMs: PROVIDER_CACHE_TTL_MS,
      headers: this.getWikidataHeaders(),
      retryAfterMaxMs: 1_000,
    });
    const entities = this.readPath(responseBody, ['entities']);

    if (!this.isRecord(entities)) {
      return entityMap;
    }

    for (const id of ids) {
      const entity = entities[id];

      if (this.isRecord(entity) && !entity.missing) {
        entityMap.set(id, entity);
      }
    }

    return entityMap;
  }

  private getWikidataHeaders() {
    return {
      'User-Agent': WIKIDATA_USER_AGENT,
    };
  }

  private getWikidataSearchLanguage(query: string) {
    if (/[가-힣]/u.test(query)) {
      return 'ko';
    }

    if (/[\u3040-\u30ff]/u.test(query)) {
      return 'ja';
    }

    return 'en';
  }

  private readWikidataRelatedEntityIds(entity: UnknownRecord) {
    return [
      ...Object.keys(WIKIDATA_CLAIM_MAPPINGS.contributor),
      ...WIKIDATA_CLAIM_MAPPINGS.franchise,
      ...WIKIDATA_CLAIM_MAPPINGS.partOf,
    ].flatMap((property) =>
      this.readWikidataClaims(entity, property).flatMap((claim) => {
        const entityId = this.readWikidataClaimEntityId(claim);

        return entityId ? [entityId] : [];
      }),
    );
  }

  private readWikidataMultilingualValues(value: unknown) {
    if (!this.isRecord(value)) {
      return [];
    }

    const values = ['ko', 'en', 'ja', 'mul'].map((language) => {
      const entry = value[language];

      return this.isRecord(entry) ? this.readString(entry.value) : '';
    });

    return this.uniqueNonEmpty(values);
  }

  private readWikidataAliases(value: unknown) {
    if (!this.isRecord(value)) {
      return [];
    }

    return this.uniqueNonEmpty(
      ['ko', 'en', 'ja', 'mul'].flatMap((language) => {
        const entries = value[language];

        return Array.isArray(entries)
          ? entries.map((entry) =>
              this.isRecord(entry) ? this.readString(entry.value) : '',
            )
          : [];
      }),
    );
  }

  private readWikidataClaims(entity: UnknownRecord, property: string) {
    const claims = this.readPath(entity, ['claims', property]);

    return Array.isArray(claims)
      ? claims.filter((claim): claim is UnknownRecord => this.isRecord(claim))
      : [];
  }

  private readWikidataClaimValue(claim: UnknownRecord) {
    return this.readPath(claim, ['mainsnak', 'datavalue', 'value']);
  }

  private readWikidataClaimString(claim: UnknownRecord) {
    const value = this.readWikidataClaimValue(claim);

    return this.readString(value);
  }

  private readWikidataClaimEntityId(claim: UnknownRecord) {
    const value = this.readWikidataClaimValue(claim);

    if (!this.isRecord(value)) {
      return null;
    }

    const id = this.readString(value.id);

    if (/^Q\d+$/u.test(id)) {
      return id;
    }

    const numericId = this.readNumber(value['numeric-id']);

    return numericId ? `Q${numericId}` : null;
  }

  private readWikidataRelatedLabel(
    entity: UnknownRecord,
    properties: readonly string[],
    relatedEntityMap: Map<string, UnknownRecord>,
  ) {
    for (const property of properties) {
      for (const claim of this.readWikidataClaims(entity, property)) {
        const entityId = this.readWikidataClaimEntityId(claim);
        const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
        const label = relatedEntity
          ? this.readWikidataMultilingualValues(relatedEntity.labels)[0]
          : '';

        if (label) {
          return label;
        }
      }
    }

    return null;
  }

  private readWikidataContributors(
    entity: UnknownRecord,
    relatedEntityMap: Map<string, UnknownRecord>,
  ) {
    return Object.entries(WIKIDATA_CLAIM_MAPPINGS.contributor)
      .flatMap(([property, role]) =>
        this.readWikidataClaims(entity, property).flatMap((claim) => {
          const entityId = this.readWikidataClaimEntityId(claim);
          const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
          const name = relatedEntity
            ? this.readWikidataMultilingualValues(relatedEntity.labels)[0]
            : '';

          return name ? [{ name, role }] : [];
        }),
      )
      .slice(0, 8);
  }

  private readWikidataRelations(
    entity: UnknownRecord,
    relatedEntityMap: Map<string, UnknownRecord>,
  ) {
    const relationInputs: Array<{
      properties: readonly string[];
      relationType: string;
    }> = [
      {
        properties: WIKIDATA_CLAIM_MAPPINGS.franchise,
        relationType: 'series',
      },
      {
        properties: WIKIDATA_CLAIM_MAPPINGS.partOf,
        relationType: 'part_of',
      },
    ];

    return relationInputs.flatMap(({ properties, relationType }) =>
      properties.flatMap((property) =>
        this.readWikidataClaims(entity, property).flatMap((claim) => {
          const entityId = this.readWikidataClaimEntityId(claim);
          const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
          const targetTitle = relatedEntity
            ? this.readWikidataMultilingualValues(relatedEntity.labels)[0]
            : '';

          return targetTitle ? [{ relationType, targetTitle }] : [];
        }),
      ),
    );
  }

  private readWikidataExternalRefs(entity: UnknownRecord) {
    const refs: CatalogExternalRefInput[] = [];

    for (const [property, metadata] of Object.entries(
      WIKIDATA_CLAIM_MAPPINGS.externalRef,
    )) {
      for (const claim of this.readWikidataClaims(entity, property)) {
        const externalId = this.readWikidataClaimString(claim).trim();

        if (!externalId) {
          continue;
        }

        refs.push({
          externalId,
          provider: metadata.provider,
          rawType: metadata.rawType,
          url: this.buildExternalRefUrl({
            externalId,
            provider: metadata.provider,
            rawType: metadata.rawType,
          }),
        });
      }
    }

    return refs;
  }

  private readWikidataIsbns(entity: UnknownRecord) {
    return this.uniqueNonEmpty([
      ...this.readWikidataClaims(entity, 'P212').map((claim) =>
        normalizeIsbn(this.readWikidataClaimString(claim)) ?? '',
      ),
      ...this.readWikidataClaims(entity, 'P957').map((claim) =>
        normalizeIsbn(this.readWikidataClaimString(claim)) ?? '',
      ),
    ]);
  }

  private readWikidataSitelinkUrl(value: unknown) {
    if (!this.isRecord(value)) {
      return '';
    }

    const preferredSites = ['kowiki', 'enwiki', 'jawiki'];

    for (const site of preferredSites) {
      const sitelink = value[site];

      if (!this.isRecord(sitelink)) {
        continue;
      }

      const url = this.readString(sitelink.url);

      if (url) {
        return url;
      }

      const title = this.readString(sitelink.title);

      if (title) {
        const language = site.replace(/wiki$/u, '');

        return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(
          title.replace(/ /g, '_'),
        )}`;
      }
    }

    return '';
  }

  private readWikidataThumbnailUrl(entity: UnknownRecord) {
    const imageName = this.readWikidataClaims(entity, 'P18')
      .map((claim) => this.readWikidataClaimString(claim))
      .find(Boolean);

    return imageName
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
          imageName,
        )}?width=500`
      : '';
  }

  private readWikidataReleaseYear(entity: UnknownRecord) {
    for (const property of WIKIDATA_CLAIM_MAPPINGS.releaseDate) {
      for (const claim of this.readWikidataClaims(entity, property)) {
        const value = this.readWikidataClaimValue(claim);
        const time = this.isRecord(value) ? this.readString(value.time) : '';
        const match = time.match(/[+-](\d{4})-/u);

        if (match?.[1]) {
          return this.parseYear(match[1]);
        }
      }
    }

    return null;
  }

  private inferWikidataWorkType(entity: UnknownRecord) {
    const instanceQids = new Set(
      WIKIDATA_CLAIM_MAPPINGS.instanceOf.flatMap((property) =>
        this.readWikidataClaims(entity, property).flatMap((claim) => {
          const entityId = this.readWikidataClaimEntityId(claim);

          return entityId ? [entityId] : [];
        }),
      ),
    );

    for (const [type, qids] of Object.entries(WIKIDATA_WORK_TYPE_QIDS)) {
      if (qids?.some((qid) => instanceQids.has(qid))) {
        return type as WorkType;
      }
    }

    return WorkType.other;
  }

  private calculateWikidataConfidence(input: {
    aliases: string[];
    index: number;
    query: string;
    title: string;
  }) {
    const normalizedQuery = normalizeImportTitleSignal(input.query);
    const normalizedTitle = normalizeImportTitleSignal(input.title);
    const normalizedAliases = input.aliases
      .map(normalizeImportTitleSignal)
      .filter(Boolean);
    const rankPenalty = Math.min(input.index, 6) * 0.03;

    if (normalizedQuery && normalizedTitle === normalizedQuery) {
      return Math.max(0.58, 0.8 - rankPenalty);
    }

    if (
      normalizedQuery &&
      normalizedAliases.some((alias) => alias === normalizedQuery)
    ) {
      return Math.max(0.55, 0.74 - rankPenalty);
    }

    if (
      normalizedQuery &&
      normalizedTitle &&
      (normalizedTitle.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedTitle))
    ) {
      return Math.max(0.44, 0.6 - rankPenalty);
    }

    if (
      normalizedQuery &&
      normalizedAliases.some(
        (alias) =>
          alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
      )
    ) {
      return Math.max(0.42, 0.56 - rankPenalty);
    }

    return Math.max(0.28, 0.45 - rankPenalty);
  }

  private getWikidataReason(query: string, title: string, aliases: string[]) {
    const normalizedQuery = normalizeImportTitleSignal(query);
    const normalizedTitle = normalizeImportTitleSignal(title);
    const normalizedAliases = aliases
      .map(normalizeImportTitleSignal)
      .filter(Boolean);

    if (normalizedQuery && normalizedTitle === normalizedQuery) {
      return 'Wikidata 제목 정확히 일치';
    }

    if (
      normalizedQuery &&
      normalizedAliases.some((alias) => alias === normalizedQuery)
    ) {
      return 'Wikidata 별칭 제목 일치';
    }

    return 'Wikidata 제목/별칭 검색 결과';
  }

  private buildExternalRefUrl(input: {
    externalId: string;
    provider: string;
    rawType: string;
  }) {
    const encoded = encodeURIComponent(input.externalId);

    if (input.provider === 'imdb') {
      return `https://www.imdb.com/title/${encoded}/`;
    }

    if (input.provider === 'tmdb') {
      return `https://www.themoviedb.org/${input.rawType}/${encoded}`;
    }

    if (input.provider === 'anilist') {
      return `https://anilist.co/${input.rawType}/${encoded}`;
    }

    if (input.provider === 'open_library') {
      return input.externalId.startsWith('/')
        ? `https://openlibrary.org${input.externalId}`
        : `https://openlibrary.org/works/${encoded}`;
    }

    if (input.provider === 'google_books') {
      return `https://books.google.com/books?id=${encoded}`;
    }

    return '';
  }

  private dedupeRawExternalRefs(
    externalRefs: CatalogExternalRefInput[],
  ): ImportCandidateResponseDto['externalRefs'] {
    const refs = new Map<string, ImportCandidateResponseDto['externalRefs'][number]>();

    for (const ref of externalRefs) {
      const key = `${ref.provider}:${ref.rawType ?? ''}:${ref.externalId}`;

      if (!ref.provider || !ref.externalId || refs.has(key)) {
        continue;
      }

      refs.set(key, {
        externalId: ref.externalId,
        provider: ref.provider,
        rawType: ref.rawType ?? '',
        url: ref.url ?? '',
      });
    }

    return [...refs.values()];
  }

  private uniqueNonEmpty(values: string[]) {
    const unique = new Map<string, string>();

    for (const value of values) {
      const normalized = this.normalizeWhitespace(value);
      const key = normalizeImportTitleSignal(normalized);

      if (!normalized || unique.has(key)) {
        continue;
      }

      unique.set(key, normalized);
    }

    return [...unique.values()];
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
      ...this.getProviderCircuitStatus(provider),
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
    if (
      !(IMPORT_PROVIDER_VALUES as readonly string[]).includes(providerInput)
    ) {
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

  private async getProviderCredentialValuesWithFallback(
    userId: string,
    provider: ImportProvider,
    fallbackProvider: ImportProvider,
  ) {
    return (
      (await this.getProviderCredentialValues(userId, provider)) ??
      this.getProviderCredentialValues(userId, fallbackProvider)
    );
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
      retryAfterMaxMs?: number;
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
      response = await this.fetchWithTimeout(url, {
        body: options.body,
        headers,
        method: options.method ?? 'GET',
        timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
      });

      if (response.status === 429) {
        const retryAfterMs = this.parseRetryAfterMs(
          response.headers.get('retry-after'),
        );

        if (
          retryAfterMs !== null &&
          retryAfterMs <= (options.retryAfterMaxMs ?? 0)
        ) {
          await this.delay(retryAfterMs);
          response = await this.fetchWithTimeout(url, {
            body: options.body,
            headers,
            method: options.method ?? 'GET',
            timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
          });
        }
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

  private async fetchWithTimeout(
    url: URL,
    input: {
      body: string | undefined;
      headers: Record<string, string>;
      method: string;
      timeoutMs: number;
    },
  ) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
    const requestInit: RequestInit = {
      headers: input.headers,
      method: input.method,
      signal: abortController.signal,
    };

    if (input.body !== undefined) {
      requestInit.body = input.body;
    }

    try {
      return await fetch(url, requestInit);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseRetryAfterMs(value: string | null) {
    if (!value) {
      return null;
    }

    const seconds = Number(value);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.round(seconds * 1_000);
    }

    const dateMs = Date.parse(value);

    if (Number.isFinite(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }

    return null;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
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

  private isServerSearchGuestEnabled() {
    return (
      process.env.IMPORT_SERVER_SEARCH_GUEST_ENABLED?.trim().toLowerCase() ===
      'true'
    );
  }

  private getServerProviderApiKey(provider: ImportProvider) {
    void provider;
    return '';
  }

  private buildGeneralWebSearchQuery(query: string, mediumType?: WorkType) {
    const normalizedQuery = this.normalizeProviderSearchQuery(query);

    if (mediumType === WorkType.web_novel) {
      return `"${normalizedQuery}" 웹소설 OR 소설`;
    }

    if (mediumType === WorkType.webtoon) {
      return `"${normalizedQuery}" 웹툰 OR 만화`;
    }

    if (mediumType === WorkType.anime) {
      return `"${normalizedQuery}" anime OR 애니`;
    }

    return `"${normalizedQuery}" 웹소설 OR 웹툰 OR 애니`;
  }

  private normalizeWebSearchTitle(value: string) {
    return this.normalizeWhitespace(value)
      .replace(
        /\s*(?:[-|:]\s*)?(?:네이버\s*시리즈|네이버\s*웹툰|카카오페이지|카카오\s*웹툰|리디|문피아|노벨피아|조아라)\s*$/iu,
        '',
      )
      .replace(
        /\s*(?:\(?\s*(?:외전|특별편|개정판|완전판|번외편|후일담|시즌\s*\d+)\s*\)?|\d+(?:\.\d+)?\s*(?:권|화|회|부)|vol(?:ume)?\.?\s*\d+)\s*$/iu,
        '',
      )
      .trim();
  }

  private inferWebSearchWorkType(input: {
    description: string;
    requestedMediumType: WorkType | undefined;
    title: string;
    url: string;
  }) {
    if (
      input.requestedMediumType === WorkType.web_novel ||
      input.requestedMediumType === WorkType.webtoon
    ) {
      return input.requestedMediumType;
    }

    const hostname = this.readHostname(input.url);
    const searchable = `${input.title} ${input.description}`.toLowerCase();

    if (
      hostname === 'comic.naver.com' ||
      hostname === 'webtoon.kakao.com' ||
      searchable.includes('웹툰')
    ) {
      return WorkType.webtoon;
    }

    if (
      hostname === 'series.naver.com' ||
      hostname === 'page.kakao.com' ||
      hostname.endsWith('ridibooks.com') ||
      hostname.endsWith('munpia.com') ||
      hostname.endsWith('novelpia.com') ||
      hostname.endsWith('joara.com') ||
      searchable.includes('웹소설')
    ) {
      return WorkType.web_novel;
    }

    return null;
  }

  private getWebSourceLabel(url: string) {
    const hostname = this.readHostname(url);

    if (hostname === 'series.naver.com') {
      return 'Naver Series';
    }

    if (hostname === 'comic.naver.com') {
      return 'Naver Webtoon';
    }

    if (hostname === 'page.kakao.com') {
      return 'Kakao Page';
    }

    if (hostname === 'webtoon.kakao.com') {
      return 'Kakao Webtoon';
    }

    if (hostname.endsWith('ridibooks.com')) {
      return 'Ridi';
    }

    if (hostname.endsWith('munpia.com')) {
      return 'Munpia';
    }

    if (hostname.endsWith('novelpia.com')) {
      return 'Novelpia';
    }

    if (hostname.endsWith('joara.com')) {
      return 'Joara';
    }

    return hostname;
  }

  private readHostname(url: string) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
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

  private readCandidateWorkType(value: unknown) {
    const normalized = this.readString(value);

    if ((Object.values(WorkType) as string[]).includes(normalized)) {
      return normalized as WorkType;
    }

    throw new BadRequestException('Import candidate type is required.');
  }

  private readCandidateContributors(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!this.isRecord(entry)) {
          return null;
        }

        return {
          name: this.readString(entry.name),
          role: this.readString(entry.role) || 'creator',
        };
      })
      .filter((entry): entry is { name: string; role: string } =>
        Boolean(entry?.name),
      );
  }

  private readCandidateExternalRefs(
    value: unknown,
  ): ImportCandidateResponseDto['externalRefs'] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!this.isRecord(entry)) {
          return null;
        }

        const provider = this.readString(entry.provider);
        const externalId = this.readString(entry.externalId);

        if (!provider || !externalId) {
          return null;
        }

        const externalRef: ImportCandidateResponseDto['externalRefs'][number] = {
          externalId,
          provider,
          rawType: this.readString(entry.rawType),
          url: this.readString(entry.url),
        };

        return externalRef;
      })
      .filter(
        (
          entry,
        ): entry is ImportCandidateResponseDto['externalRefs'][number] =>
          entry !== null,
      );
  }

  private readCandidateRelations(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!this.isRecord(entry)) {
          return null;
        }

        return {
          relationType: this.readString(entry.relationType),
          targetTitle: this.readString(entry.targetTitle),
        };
      })
      .filter(
        (entry): entry is { relationType: string; targetTitle: string } =>
          Boolean(entry?.relationType && entry.targetTitle),
      );
  }

  private readCandidateReleases(
    value: unknown,
  ): CatalogReleaseCandidateInput[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!this.isRecord(entry)) {
          return null;
        }

        const externalRefs = this.readCandidateExternalRefs(entry.externalRefs);

        const release: CatalogReleaseCandidateInput = {
          displayLabel: this.readString(entry.displayLabel),
          externalRefs,
          isbn: this.readString(entry.isbn) || null,
          releaseDate: this.readString(entry.releaseDate) || null,
          releaseType: this.readString(entry.releaseType),
          sequence: this.readNumber(entry.sequence),
          thumbnailUrl: this.readString(entry.thumbnailUrl),
          title: this.readString(entry.title),
        };

        return release;
      })
      .filter((entry): entry is CatalogReleaseCandidateInput => entry !== null);
  }

  private readCandidateScoreBreakdown(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!this.isRecord(entry)) {
          return null;
        }

        return {
          label: this.readString(entry.label),
          weight: this.readNumber(entry.weight) ?? 0,
        };
      })
      .filter((entry): entry is { label: string; weight: number } =>
        Boolean(entry?.label),
      );
  }

  private getCandidateSourceLabel(sourceId: string) {
    return (PROVIDERS as Partial<Record<string, ProviderMetadata>>)[sourceId]
      ?.label ?? sourceId;
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
