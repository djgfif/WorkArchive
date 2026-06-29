import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { CatalogIngestionService } from '../catalog/catalog-ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from '../../observability/metrics.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportProviderKeyTestResponseDto } from './dto/import-provider-key-test-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import type { ProviderCredentialValues } from './providers/import-provider-adapter';
import { ImportsCredentialService } from './credentials/imports-credential.service';
import { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';
import {
  ALADIN_PROVIDER,
  IMPORT_PROVIDER_VALUES,
  type ImportProvider,
} from './imports.constants';
import { isServerSearchGuestEnabled } from './providers/import-provider-config';
import {
  fetchImportProviderJson,
  type ImportProviderFetchOptions,
} from './providers/import-provider-http';
import { buildResolvedImportCandidate } from './resolve-import-candidate';
import { searchInternalCatalogImportCandidates } from './internal-catalog-import-candidates';
import {
  buildImportProviderStatus,
  isImportProviderConfigured,
} from './import-provider-readiness';
import { decorateImportCandidates } from './import-candidate-decoration';
import { runImportProviderSearchStage } from './import-provider-search-stage';
import { buildImportProviderCredentialRuntime } from './import-provider-credential-runtime';
import {
  collectImportProviderSearchResults,
  getImportSearchResultStatus,
  getImportSearchSummaryStatus,
  logImportProviderFailure,
  logImportSearchSummary,
  recordImportSearchMetric,
} from './import-search-observability';
import {
  deleteImportProviderKey,
  saveImportProviderKey,
  testImportProviderKey,
} from './import-provider-key-management';
import { buildImportSearchContext } from './import-search-context';
import {
  buildImportSearchResponse,
  mergeImportSearchCandidates,
  mergeAndRankImportSearchCandidates,
} from './import-search-result';

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
        return buildImportProviderStatus({
          circuitStatus:
            await this.providerRuntimeState.getCircuitStatus(provider),
          configured: await this.isProviderConfigured(userId, provider),
          provider,
        });
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
    return saveImportProviderKey({
      credentialStore: this.credentialService,
      getCircuitStatus: this.providerRuntimeState.getCircuitStatus.bind(
        this.providerRuntimeState,
      ),
      providerInput,
      userId,
      values,
    });
  }

  async deleteProviderKey(userId: string, providerInput: string) {
    await deleteImportProviderKey({
      credentialStore: this.credentialService,
      providerInput,
      userId,
    });
  }

  async testProviderKey(
    userId: string,
    providerInput: string,
  ): Promise<ImportProviderKeyTestResponseDto> {
    return testImportProviderKey({
      credentialReader: this.credentialService,
      fetchJson: this.fetchJson.bind(this),
      providerInput,
      userId,
    });
  }

  async search(
    userId: string | null,
    searchQuery: ImportSearchQueryDto,
    requestId?: string,
  ): Promise<ImportSearchResponseDto> {
    const context = buildImportSearchContext({
      searchQuery,
      serverSearchGuestEnabled: isServerSearchGuestEnabled(),
      userId,
    });
    const startedAt = process.hrtime.bigint();

    try {
      const candidates: ImportCandidateResponseDto[] = [];
      const catalogCandidates =
        context.explicitSingleProvider || searchQuery.providers !== undefined
          ? []
          : await searchInternalCatalogImportCandidates({
              limit: context.limit,
              mediumType: context.mediumType,
              prisma: this.prisma,
              query: context.query,
            });

      candidates.push(...catalogCandidates);

      const providerResults = await runImportProviderSearchStage({
        explicitSingleProvider: context.explicitSingleProvider,
        limit: context.limit,
        mediumType: context.mediumType,
        ports: {
          isProviderConfigured: this.isProviderConfigured.bind(this),
          logProviderFailure: (fields) =>
            logImportProviderFailure(this.logger, fields),
          metricsService: this.metricsService,
          providerRuntimeState: this.providerRuntimeState,
          searchRuntime: buildImportProviderCredentialRuntime({
            credentialReader: this.credentialService,
            fetchJson: this.fetchJson.bind(this),
          }),
        },
        providers: context.providers,
        query: context.query,
        ...(requestId ? { requestId } : {}),
        resolvedProviders: context.resolvedProviders,
        userId,
      });
      const providerOutcome =
        collectImportProviderSearchResults(providerResults);

      candidates.push(...providerOutcome.candidates);

      const decoratedCandidates = await decorateImportCandidates({
        candidates: mergeImportSearchCandidates(candidates),
        catalogMatcher: this.catalogIngestionService,
        recordReader: this.prisma,
        userId,
      });
      const rankedCandidates = mergeAndRankImportSearchCandidates({
        candidates: decoratedCandidates,
        limit: context.limit,
        mediumType: context.mediumType,
        query: context.query,
      });
      const resultStatus = getImportSearchResultStatus(
        providerOutcome.failures,
      );

      logImportSearchSummary(this.logger, {
        provider: context.providers.join(','),
        query: context.query,
        ...(requestId ? { requestId } : {}),
        resultCount: rankedCandidates.length,
        status: getImportSearchSummaryStatus(providerOutcome.failures),
        userId,
      });
      recordImportSearchMetric({
        mediumType: context.mediumType,
        metricsService: this.metricsService,
        providerCount: context.providers.length,
        result: resultStatus,
        startedAt,
        userId,
      });

      return buildImportSearchResponse({
        candidates: rankedCandidates,
        diagnostics: providerOutcome.diagnostics,
        provider: context.responseProvider,
        providers: context.providers,
        query: context.query,
      });
    } catch (error) {
      recordImportSearchMetric({
        userId,
        mediumType: context.mediumType,
        metricsService: this.metricsService,
        providerCount: context.providers.length,
        result: 'failure',
        startedAt,
      });
      throw error;
    }
  }

  async resolveCandidate(
    userId: string | null,
    candidateInput: unknown,
  ): Promise<ImportCandidateResponseDto> {
    const normalized = buildResolvedImportCandidate(candidateInput);
    const [decorated] = await decorateImportCandidates({
      candidates: [normalized],
      catalogMatcher: this.catalogIngestionService,
      recordReader: this.prisma,
      userId,
    });

    return decorated ?? normalized;
  }

  private async isProviderConfigured(
    userId: string | null,
    provider: ImportProvider,
  ) {
    return isImportProviderConfigured({
      credentialStore: this.credentialService,
      provider,
      userId,
    });
  }

  private async fetchJson(
    rawUrl: URL | string,
    options: ImportProviderFetchOptions,
  ) {
    return fetchImportProviderJson(this.providerRuntimeState, rawUrl, options);
  }
}
