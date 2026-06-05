import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { WorkType, type Prisma } from '@prisma/client';

import {
  CatalogIngestionService,
  type CatalogReleaseCandidateInput,
} from '../catalog/catalog-ingestion.service';
import { searchCatalogTitleIds } from '../catalog/catalog-title-search';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from '../../observability/metrics.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportProviderKeyTestResponseDto } from './dto/import-provider-key-test-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { mergeImportCandidates } from './candidates/import-candidate-merge';
import { normalizeImportCandidate } from './candidates/import-candidate-normalization';
import { rankImportCandidates } from './candidates/import-candidate-ranking';
import {
  PROVIDERS,
  type ProviderCredentialValues,
  type ProviderMetadata,
  type ProviderSearchContext,
} from './providers/import-provider-adapter';
import {
  addProviderDiagnostic,
  createImportSearchDiagnostics,
  type ImportSearchDiagnosticReasonCode,
  type ImportSearchDiagnosticStatus,
  type ImportSearchDiagnostics,
} from './diagnostics/import-search-diagnostics';
import { ImportsCredentialService } from './credentials/imports-credential.service';
import {
  assertUserCredentialProvider,
  buildProviderKeyTestResponse,
  classifyProviderKeyTestFailure,
  getProviderKeyTestFailureMessage,
  normalizeCredentialValues,
  parseCredentialValues,
} from './credentials/import-provider-credentials';
import { runImportProviderKeyTest } from './credentials/import-provider-key-tester';
import { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';
import {
  ALADIN_PROVIDER,
  IMPORT_PROVIDER_VALUES,
  KAKAO_BOOK_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  KAKAO_WEB_PROVIDER,
  type ImportProvider,
} from './imports.constants';
import {
  PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
  PROVIDER_CIRCUIT_OPEN_MS,
  getKobisDisabledMessage,
  getServerProviderApiKey,
  getServerProviderCredentialValues,
  hasServerProviderCredential,
  isKobisHttpProviderEnabled,
  isServerSearchGuestEnabled,
} from './providers/import-provider-config';
import {
  getFormatLabel,
  normalizeWhitespace,
  parseYear,
} from './providers/import-candidate-builder';
import {
  isRecord,
  readNumber,
  readString,
  readStringArray,
} from './providers/import-candidate-readers';
import {
  fetchImportProviderJson,
  type ImportProviderFetchOptions,
} from './providers/import-provider-http';
import {
  importProviderSupportsMedium,
  normalizeImportSearchLimit,
  resolveGuestSearchProviders,
  resolveImportProviders,
} from './providers/import-provider-selection';
import { searchImportProviderWithFallback } from './providers/import-provider-search';

const IMPORT_SEARCH_STAGE_CACHE_TTL_MS = 60_000;
const INTERNAL_CATALOG_SOURCE_ID = 'catalog';

const IMPORT_CATALOG_TITLE_INCLUDE = {
  contributors: {
    include: {
      contributor: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  },
  externalRefs: true,
  franchise: true,
  releases: {
    include: {
      externalRefs: true,
    },
    orderBy: {
      sequence: 'asc',
    },
    take: 5,
  },
} satisfies Prisma.CatalogTitleInclude;

type ImportCatalogTitleCandidate = Prisma.CatalogTitleGetPayload<{
  include: typeof IMPORT_CATALOG_TITLE_INCLUDE;
}>;

interface ImportProviderSearchResult {
  candidates: ImportCandidateResponseDto[];
  diagnostic: {
    configured: boolean;
    message: string;
    reasonCode: ImportSearchDiagnosticReasonCode | null;
    resultCount: number;
    status: ImportSearchDiagnosticStatus;
  };
  failure: string | null;
  provider: ImportProvider;
}

interface CachedImportSearchStage {
  providerResults: ImportProviderSearchResult[];
}

function isImportProviderSearchResult(
  value: unknown,
): value is ImportProviderSearchResult {
  if (!isRecord(value)) {
    return false;
  }

  const diagnostic = value.diagnostic;

  return (
    typeof value.provider === 'string' &&
    Array.isArray(value.candidates) &&
    (value.failure === null || typeof value.failure === 'string') &&
    isRecord(diagnostic) &&
    typeof diagnostic.configured === 'boolean' &&
    typeof diagnostic.message === 'string' &&
    (diagnostic.reasonCode === null ||
      typeof diagnostic.reasonCode === 'string') &&
    typeof diagnostic.resultCount === 'number' &&
    typeof diagnostic.status === 'string'
  );
}

function isCachedImportSearchStage(
  value: unknown,
): value is CachedImportSearchStage {
  return (
    isRecord(value) &&
    Array.isArray(value.providerResults) &&
    value.providerResults.every(isImportProviderSearchResult)
  );
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

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
      catalogTitle: {
        findMany: async () => [],
      },
      userWorkRecord: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService,
    @Inject(ProviderRuntimeStateService)
    @Optional()
    private readonly providerRuntimeState: ProviderRuntimeStateService = new ProviderRuntimeStateService(),
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
          ...(await this.providerRuntimeState.getCircuitStatus(provider)),
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
    const provider = assertUserCredentialProvider(providerInput);
    const credentialValues = normalizeCredentialValues(provider, values);

    await this.credentialService.saveCredential(
      userId,
      provider,
      JSON.stringify(credentialValues),
    );

    return this.buildProviderStatus(provider, true);
  }

  async deleteProviderKey(userId: string, providerInput: string) {
    const provider = assertUserCredentialProvider(providerInput);

    await this.credentialService.deleteCredential(userId, provider);
  }

  async testProviderKey(
    userId: string,
    providerInput: string,
  ): Promise<ImportProviderKeyTestResponseDto> {
    const provider = assertUserCredentialProvider(providerInput);
    const checkedAt = new Date().toISOString();
    const credentials = await this.getProviderCredentialValues(userId, provider);

    if (!credentials) {
      return buildProviderKeyTestResponse({
        checkedAt,
        message: `${PROVIDERS[provider].label} API key is not configured.`,
        ok: false,
        provider,
        reason: 'missing_key',
      });
    }

    try {
      await runImportProviderKeyTest(
        provider,
        credentials,
        this.fetchJson.bind(this),
      );

      return buildProviderKeyTestResponse({
        checkedAt,
        message: `${PROVIDERS[provider].label} API key connection test succeeded.`,
        ok: true,
        provider,
        reason: null,
      });
    } catch (error) {
      const reason = classifyProviderKeyTestFailure(error);

      return buildProviderKeyTestResponse({
        checkedAt,
        message: getProviderKeyTestFailureMessage(provider, reason),
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
    const limit = normalizeImportSearchLimit(searchQuery.limit);
    const mediumType = searchQuery.mediumType ?? searchQuery.type;
    const resolvedProviders = resolveImportProviders(searchQuery, mediumType);
    const providers = resolveGuestSearchProviders({
      providers: resolvedProviders,
      searchQuery,
      userId,
      serverSearchGuestEnabled: isServerSearchGuestEnabled(),
    });
    const explicitSingleProvider =
      searchQuery.provider !== undefined && searchQuery.providers === undefined;

    if (!query) {
      throw new BadRequestException('query must not be empty');
    }

    const startedAt = process.hrtime.bigint();

    try {
      const candidates: ImportCandidateResponseDto[] = [];
      const failures: string[] = [];
      const diagnostics = createImportSearchDiagnostics();
      const catalogCandidates =
        explicitSingleProvider || searchQuery.providers !== undefined
          ? []
          : await this.searchInternalCatalogCandidates({
              limit,
              mediumType,
              query,
            });

      candidates.push(...catalogCandidates);

      const cacheKey = explicitSingleProvider
        ? null
        : this.buildImportSearchStageCacheKey({
            limit,
            mediumType,
            providers: resolvedProviders,
            query,
            userId,
          });
      const cachedSearchStage = cacheKey
        ? await this.readCachedImportSearchStage(cacheKey)
        : null;
      const providerResults =
        cachedSearchStage?.providerResults ??
        (await Promise.all(
          resolvedProviders.map((provider) =>
            this.searchImportProviderForQuery(provider, {
              explicitSingleProvider,
              limit,
              mediumType,
              providers,
              query,
              userId,
            }),
          ),
        ));

      if (
        cacheKey &&
        !cachedSearchStage &&
        this.canCacheImportSearchStage(providerResults)
      ) {
        await this.providerRuntimeState.writeCache(
          cacheKey,
          { providerResults } satisfies CachedImportSearchStage,
          IMPORT_SEARCH_STAGE_CACHE_TTL_MS,
        );
      }

      for (const result of providerResults) {
        candidates.push(...result.candidates);

        if (result.failure) {
          failures.push(result.failure);
        }

        this.addSearchDiagnostic(diagnostics, result.provider, result.diagnostic);
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
      const resultStatus = failures.length > 0 ? 'partial' : 'ok';

      this.logSearchSummary(
        userId,
        providers.join(','),
        query,
        rankedCandidates.length,
        failures.length > 0 ? `partial:${failures.join('|')}` : 'ok',
      );
      this.recordImportSearchMetric(
        userId,
        mediumType,
        providers.length,
        resultStatus,
        startedAt,
      );

      return {
        provider: searchQuery.provider ?? providers[0] ?? ALADIN_PROVIDER,
        providers,
        query,
        candidates: rankedCandidates,
        diagnostics,
      };
    } catch (error) {
      this.recordImportSearchMetric(
        userId,
        mediumType,
        providers.length,
        'failure',
        startedAt,
      );
      throw error;
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

  private recordImportSearchMetric(
    userId: string | null,
    mediumType: WorkType | undefined,
    providerCount: number,
    result: string,
    startedAt: bigint,
  ) {
    this.metricsService?.recordImportsSearch(
      {
        auth_scope: userId ? 'user' : 'guest',
        medium_type: mediumType ?? 'all',
        provider_count: providerCount.toString(),
        result,
      },
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
    );
  }

  async resolveCandidate(
    userId: string | null,
    candidateInput: unknown,
  ): Promise<ImportCandidateResponseDto> {
    if (!isRecord(candidateInput)) {
      throw new BadRequestException('Import candidate payload must be an object.');
    }

    const type = this.readCandidateWorkType(
      candidateInput.mediumType ?? candidateInput.type,
    );
    const title = normalizeWhitespace(readString(candidateInput.title));

    if (!title) {
      throw new BadRequestException('Import candidate title is required.');
    }

    const sourceId =
      normalizeWhitespace(
        readString(candidateInput.sourceId ?? candidateInput.provider),
      ) || MANUAL_PROVIDER;
    const externalId =
      normalizeWhitespace(readString(candidateInput.externalId)) ||
      `${sourceId}:${title}`;
    const externalRefs = this.readCandidateExternalRefs(
      candidateInput.externalRefs,
    );

    const normalized = normalizeImportCandidate({
      author: readString(candidateInput.author),
      catalogMatch: null,
      confidence: readNumber(candidateInput.confidence) ?? 0.5,
      confidenceLabel: readString(candidateInput.confidenceLabel),
      contributors: this.readCandidateContributors(candidateInput.contributors),
      countLabel: readString(candidateInput.countLabel),
      description: readString(candidateInput.description),
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
                url: readString(candidateInput.sourceUrl),
              },
            ],
      formatLabel:
        readString(candidateInput.formatLabel) || getFormatLabel(type),
      franchiseName:
        normalizeWhitespace(readString(candidateInput.franchiseName)) ||
        null,
      genresText: readString(candidateInput.genresText),
      id: readString(candidateInput.id) || `${sourceId}:${externalId}`,
      mediumType: type,
      note: readString(candidateInput.note),
      reason: readString(candidateInput.reason),
      relationsHint: this.readCandidateRelations(candidateInput.relationsHint),
      releaseCandidates: this.readCandidateReleases(
        candidateInput.releaseCandidates,
      ),
      releaseYear:
        readNumber(candidateInput.releaseYear) ??
        parseYear(readString(candidateInput.releaseDate)),
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
        readString(candidateInput.sourceLabel) ||
        this.getCandidateSourceLabel(sourceId),
      sourceUrl: readString(candidateInput.sourceUrl),
      subType:
        normalizeWhitespace(readString(candidateInput.subType)) || null,
      thumbnailUrl: readString(candidateInput.thumbnailUrl),
      title,
      titleAliases: readStringArray(candidateInput.titleAliases),
      type,
    });
    const [decorated] = await this.decorateCandidates(userId, [normalized]);

    return decorated ?? normalized;
  }

  private async isProviderConfigured(
    userId: string | null,
    provider: ImportProvider,
  ) {
    const metadata = PROVIDERS[provider];

    if (provider === KOBIS_PROVIDER && !isKobisHttpProviderEnabled()) {
      return false;
    }

    if (metadata.credentialMode === 'none') {
      return true;
    }

    if (metadata.credentialMode === 'server') {
      return Boolean(getServerProviderApiKey(provider));
    }

    if (hasServerProviderCredential(provider)) {
      return true;
    }

    if (!userId) {
      return false;
    }

    if (provider === NAVER_WEB_PROVIDER) {
      return (
        hasServerProviderCredential(NAVER_BOOK_PROVIDER) ||
        (await this.credentialService.hasCredential(
          userId,
          NAVER_WEB_PROVIDER,
        )) || this.credentialService.hasCredential(userId, NAVER_BOOK_PROVIDER)
      );
    }

    if (provider === KAKAO_WEB_PROVIDER) {
      return (
        hasServerProviderCredential(KAKAO_BOOK_PROVIDER) ||
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

  private async searchImportProviderForQuery(
    provider: ImportProvider,
    input: {
      explicitSingleProvider: boolean;
      limit: number;
      mediumType: WorkType | undefined;
      providers: ImportProvider[];
      query: string;
      userId: string | null;
    },
  ): Promise<ImportProviderSearchResult> {
    if (!importProviderSupportsMedium(provider, input.mediumType)) {
      return {
        candidates: [],
        diagnostic: {
          configured: await this.isProviderConfigured(input.userId, provider),
          message: `${PROVIDERS[provider].label} does not support the selected work type.`,
          reasonCode: 'unsupported_medium',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    if (!input.providers.includes(provider)) {
      const metadata = PROVIDERS[provider];

      return {
        candidates: [],
        diagnostic: {
          configured: await this.isProviderConfigured(input.userId, provider),
          message:
            metadata.credentialMode === 'user'
              ? `${metadata.label} search requires a signed-in account.`
              : `${metadata.label} search is not available for guest search.`,
          reasonCode: 'guest_provider_not_allowed',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    const configured = await this.isProviderConfigured(input.userId, provider);

    if (provider === KOBIS_PROVIDER && !isKobisHttpProviderEnabled()) {
      if (input.explicitSingleProvider) {
        throw new ForbiddenException(getKobisDisabledMessage());
      }

      return {
        candidates: [],
        diagnostic: {
          configured,
          message: getKobisDisabledMessage(),
          reasonCode: 'server_credential_missing',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    if (!configured && PROVIDERS[provider].credentialMode === 'server') {
      return {
        candidates: [],
        diagnostic: {
          configured,
          message: `${PROVIDERS[provider].label} search is not configured on this server.`,
          reasonCode: 'server_credential_missing',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    if (
      !configured &&
      PROVIDERS[provider].credentialMode === 'user' &&
      !input.explicitSingleProvider
    ) {
      return {
        candidates: [],
        diagnostic: {
          configured,
          message: `${PROVIDERS[provider].label} search requires a configured user key.`,
          reasonCode: 'user_credential_missing',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    if (await this.providerRuntimeState.isCircuitOpen(provider)) {
      return {
        candidates: [],
        diagnostic: {
          configured,
          message: `${PROVIDERS[provider].label} search is temporarily skipped after repeated failures.`,
          reasonCode: 'circuit_open',
          resultCount: 0,
          status: 'skipped',
        },
        failure: null,
        provider,
      };
    }

    const providerStartedAt = Date.now();

    try {
      const context: ProviderSearchContext = {
        limit: input.limit,
        query: input.query,
        userId: input.userId,
      };

      if (input.mediumType !== undefined) {
        context.mediumType = input.mediumType;
      }

      const providerCandidates = await searchImportProviderWithFallback(
        provider,
        context,
        {
          fetchJson: this.fetchJson.bind(this),
          getProviderCredentialValues:
            this.getProviderCredentialValues.bind(this),
          getProviderCredentialValuesWithFallback:
            this.getProviderCredentialValuesWithFallback.bind(this),
          getSearchProviderCredentialValues:
            this.getSearchProviderCredentialValues.bind(this),
          getSearchProviderCredentialValuesWithFallback:
            this.getSearchProviderCredentialValuesWithFallback.bind(this),
        },
      );

      await this.providerRuntimeState.recordSuccess(provider);

      return {
        candidates: providerCandidates,
        diagnostic: {
          configured,
          message: `${PROVIDERS[provider].label} search completed.`,
          reasonCode: null,
          resultCount: providerCandidates.length,
          status: 'searched',
        },
        failure: null,
        provider,
      };
    } catch (error) {
      await this.providerRuntimeState.recordFailure(
        provider,
        PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
        PROVIDER_CIRCUIT_OPEN_MS,
      );
      this.metricsService?.recordImportsProviderFailure(
        provider,
        this.describeError(error),
      );
      if (
        (await this.providerRuntimeState.getCircuitStatus(provider))
          .circuitState === 'open'
      ) {
        this.metricsService?.recordImportsProviderCircuitOpen(
          provider,
          'provider_failed',
        );
      }
      if (input.explicitSingleProvider) {
        throw error;
      }

      this.logEvent('imports.provider.failed', {
        durationMs: Date.now() - providerStartedAt,
        errorCode: this.describeError(error),
        provider,
        userId: input.userId ?? undefined,
      });

      return {
        candidates: [],
        diagnostic: {
          configured,
          message: `${PROVIDERS[provider].label} search is temporarily unavailable.`,
          reasonCode: 'provider_failed',
          resultCount: 0,
          status: 'failed',
        },
        failure: `${provider}:${this.describeError(error)}`,
        provider,
      };
    }
  }

  private async searchInternalCatalogCandidates(input: {
    limit: number;
    mediumType: WorkType | undefined;
    query: string;
  }) {
    const catalogTitle = this.getCatalogTitleSearchDelegate();

    if (!catalogTitle) {
      return [];
    }

    const rankedIds = await searchCatalogTitleIds(this.prisma, {
      limit: Math.min(input.limit, 10),
      query: input.query,
      ...(input.mediumType ? { mediumType: input.mediumType } : {}),
    });

    if (rankedIds) {
      if (rankedIds.length === 0) {
        return [];
      }

      const catalogTitles = await catalogTitle.findMany({
        where: {
          id: {
            in: rankedIds,
          },
        },
        include: IMPORT_CATALOG_TITLE_INCLUDE,
      });
      const titleById = new Map(
        catalogTitles.map((title) => [title.id, title]),
      );

      return rankedIds
        .flatMap((id) => {
          const title = titleById.get(id);

          return title ? [title] : [];
        })
        .map((title) => this.toInternalCatalogImportCandidate(title));
    }

    const catalogTitles = await catalogTitle.findMany({
      where: {
        ...(input.mediumType
          ? {
              mediumType: input.mediumType,
            }
          : {}),
        OR: [
          {
            canonicalTitle: {
              contains: input.query,
              mode: 'insensitive',
            },
          },
          {
            displayTitle: {
              contains: input.query,
              mode: 'insensitive',
            },
          },
          {
            originalTitle: {
              contains: input.query,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              has: input.query,
            },
          },
          {
            contributors: {
              some: {
                contributor: {
                  displayName: {
                    contains: input.query,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      include: IMPORT_CATALOG_TITLE_INCLUDE,
      orderBy: [{ verificationStatus: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(input.limit, 10),
    });

    return catalogTitles.map((title) =>
      this.toInternalCatalogImportCandidate(title),
    );
  }

  private getCatalogTitleSearchDelegate() {
    const prisma = this.prisma as PrismaService & {
      catalogTitle?: {
        findMany?: PrismaService['catalogTitle']['findMany'];
      };
    };

    return typeof prisma.catalogTitle?.findMany === 'function'
      ? {
          findMany: prisma.catalogTitle.findMany.bind(prisma.catalogTitle),
        }
      : null;
  }

  private toInternalCatalogImportCandidate(
    title: ImportCatalogTitleCandidate,
  ): ImportCandidateResponseDto {
    const contributors = title.contributors.map((entry) => ({
      name: entry.contributor.displayName,
      role: entry.role,
    }));
    const releaseCandidates: CatalogReleaseCandidateInput[] =
      title.releases.map((release) => ({
        displayLabel: release.displayLabel,
        externalRefs: release.externalRefs.map((ref) => ({
          externalId: ref.externalId,
          provider: ref.provider,
          rawType: ref.rawType,
          url: ref.url,
        })),
        isbn: release.isbn,
        releaseDate: release.releaseDate,
        releaseType: release.releaseType,
        sequence: release.sequence,
        summary: release.summary,
        thumbnailUrl: release.thumbnailUrl,
        title: release.title,
      }));

    return normalizeImportCandidate({
      author: contributors.map((contributor) => contributor.name).join(', '),
      catalogMatch: {
        id: title.id,
        title: title.displayTitle,
        verificationStatus: title.verificationStatus,
      },
      confidence: 0.95,
      confidenceLabel: '카탈로그 일치',
      contributors,
      countLabel: title.releaseYear
        ? `${title.releaseYear}년 카탈로그`
        : '카탈로그 등록',
      description: title.summary,
      existingRecord: null,
      externalId: title.id,
      externalRefs: title.externalRefs.map((ref) => ({
        externalId: ref.externalId,
        provider: ref.provider,
        rawType: ref.rawType,
        url: ref.url,
      })),
      formatLabel: getFormatLabel(title.mediumType),
      franchiseName: title.franchise?.displayName ?? null,
      genresText: '',
      id: `${INTERNAL_CATALOG_SOURCE_ID}:${title.id}`,
      mediumType: title.mediumType,
      note: '이미 정규화된 내부 카탈로그 후보입니다.',
      reason: '내부 카탈로그 일치',
      relationsHint: [],
      releaseCandidates,
      releaseYear: title.releaseYear,
      scoreBreakdown: [],
      sourceCoverage: {
        externalIdentityCount: 0,
        providerCount: 0,
        providers: [],
        releaseCandidateCount: 0,
      },
      sourceId: INTERNAL_CATALOG_SOURCE_ID,
      sourceLabel: '내부 카탈로그',
      sourceUrl: '',
      subType: title.subType,
      thumbnailUrl: title.thumbnailUrl,
      title: title.displayTitle,
      titleAliases: [
        title.canonicalTitle,
        title.originalTitle ?? '',
        ...title.aliases,
      ],
      type: title.mediumType,
    });
  }

  private canCacheImportSearchStage(results: ImportProviderSearchResult[]) {
    return results.every((result) => result.diagnostic.status === 'searched');
  }

  private async readCachedImportSearchStage(cacheKey: string) {
    const cached = await this.providerRuntimeState.readCache(cacheKey);

    return isCachedImportSearchStage(cached) ? cached : null;
  }

  private buildImportSearchStageCacheKey(input: {
    limit: number;
    mediumType: WorkType | undefined;
    providers: ImportProvider[];
    query: string;
    userId: string | null;
  }) {
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          limit: input.limit,
          mediumType: input.mediumType ?? 'all',
          providers: input.providers,
          query: input.query.normalize('NFKC').trim().toLowerCase(),
          userScope: input.userId ?? 'guest',
        }),
      )
      .digest('base64url');

    return `imports:search-stage:${hash}`;
  }

  private async decorateCandidates(
    userId: string | null,
    candidates: ImportCandidateResponseDto[],
  ) {
    return Promise.all(
      candidates.map(async (candidate) => {
        const catalogMatch =
          candidate.catalogMatch ??
          (await this.catalogIngestionService.findCatalogMatchForImportCandidate(
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
            ));
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

  private async buildProviderStatus(
    provider: ImportProvider,
    configured: boolean,
  ): Promise<ImportProviderStatusResponseDto> {
    const metadata = PROVIDERS[provider];

    return {
      ...(await this.providerRuntimeState.getCircuitStatus(provider)),
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

    return parseCredentialValues(provider, rawCredential);
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

  private async getSearchProviderCredentialValues(
    userId: string | null,
    provider: ImportProvider,
  ) {
    const serverCredential = getServerProviderCredentialValues(provider);

    if (serverCredential) {
      return serverCredential;
    }

    return userId ? this.getProviderCredentialValues(userId, provider) : null;
  }

  private async getSearchProviderCredentialValuesWithFallback(
    userId: string | null,
    provider: ImportProvider,
    fallbackProvider: ImportProvider,
  ) {
    return (
      (await this.getSearchProviderCredentialValues(userId, provider)) ??
      this.getSearchProviderCredentialValues(userId, fallbackProvider)
    );
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
    options: ImportProviderFetchOptions,
  ) {
    return fetchImportProviderJson(this.providerRuntimeState, rawUrl, options);
  }

  private readCandidateWorkType(value: unknown) {
    const normalized = readString(value);

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
        if (!isRecord(entry)) {
          return null;
        }

        return {
          name: readString(entry.name),
          role: readString(entry.role) || 'creator',
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
        if (!isRecord(entry)) {
          return null;
        }

        const provider = readString(entry.provider);
        const externalId = readString(entry.externalId);

        if (!provider || !externalId) {
          return null;
        }

        const externalRef: ImportCandidateResponseDto['externalRefs'][number] = {
          externalId,
          provider,
          rawType: readString(entry.rawType),
          url: readString(entry.url),
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
        if (!isRecord(entry)) {
          return null;
        }

        return {
          relationType: readString(entry.relationType),
          targetTitle: readString(entry.targetTitle),
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
        if (!isRecord(entry)) {
          return null;
        }

        const externalRefs = this.readCandidateExternalRefs(entry.externalRefs);

        const release: CatalogReleaseCandidateInput = {
          displayLabel: readString(entry.displayLabel),
          externalRefs,
          isbn: readString(entry.isbn) || null,
          releaseDate: readString(entry.releaseDate) || null,
          releaseType: readString(entry.releaseType),
          sequence: readNumber(entry.sequence),
          thumbnailUrl: readString(entry.thumbnailUrl),
          title: readString(entry.title),
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
        if (!isRecord(entry)) {
          return null;
        }

        return {
          label: readString(entry.label),
          weight: readNumber(entry.weight) ?? 0,
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
