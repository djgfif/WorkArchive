import { ForbiddenException } from '@nestjs/common';
import type { WorkType } from '@prisma/client';

import type { MetricsService } from '../../observability/metrics.service';
import type { ImportProviderSearchResult } from './import-search-stage-cache';
import { KOBIS_PROVIDER, type ImportProvider } from './imports.constants';
import { PROVIDERS } from './providers/import-provider-adapter';
import {
  PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
  PROVIDER_CIRCUIT_OPEN_MS,
  getKobisDisabledMessage,
  isKobisHttpProviderEnabled,
} from './providers/import-provider-config';
import { importProviderSupportsMedium } from './providers/import-provider-selection';
import {
  searchImportProviderWithFallback,
  type ImportProviderSearchRuntime,
} from './providers/import-provider-search';
import type { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';

export interface ImportProviderSearchRunnerPorts {
  isProviderConfigured(
    userId: string | null,
    provider: ImportProvider,
  ): Promise<boolean>;
  logProviderFailure(fields: {
    durationMs: number;
    errorCode: string;
    provider: ImportProvider;
    userId: string | undefined;
  }): void;
  metricsService?: Pick<
    MetricsService,
    'recordImportsProviderCircuitOpen' | 'recordImportsProviderFailure'
  > | undefined;
  providerRuntimeState: Pick<
    ProviderRuntimeStateService,
    'getCircuitStatus' | 'isCircuitOpen' | 'recordFailure' | 'recordSuccess'
  >;
  searchRuntime: ImportProviderSearchRuntime;
}

export async function searchImportProviderForQuery(input: {
  explicitSingleProvider: boolean;
  limit: number;
  mediumType: WorkType | undefined;
  ports: ImportProviderSearchRunnerPorts;
  provider: ImportProvider;
  providers: ImportProvider[];
  query: string;
  userId: string | null;
}): Promise<ImportProviderSearchResult> {
  const { ports, provider } = input;

  if (!importProviderSupportsMedium(provider, input.mediumType)) {
    return {
      candidates: [],
      diagnostic: {
        configured: await ports.isProviderConfigured(input.userId, provider),
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
        configured: await ports.isProviderConfigured(input.userId, provider),
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

  const configured = await ports.isProviderConfigured(input.userId, provider);

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

  if (await ports.providerRuntimeState.isCircuitOpen(provider)) {
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
    const providerCandidates = await searchImportProviderWithFallback(
      provider,
      {
        ...(input.mediumType === undefined ? {} : { mediumType: input.mediumType }),
        limit: input.limit,
        query: input.query,
        userId: input.userId,
      },
      ports.searchRuntime,
    );

    await ports.providerRuntimeState.recordSuccess(provider);

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
    const errorCode = describeError(error);

    await ports.providerRuntimeState.recordFailure(
      provider,
      PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
      PROVIDER_CIRCUIT_OPEN_MS,
    );
    ports.metricsService?.recordImportsProviderFailure(provider, errorCode);

    if (
      (await ports.providerRuntimeState.getCircuitStatus(provider))
        .circuitState === 'open'
    ) {
      ports.metricsService?.recordImportsProviderCircuitOpen(
        provider,
        'provider_failed',
      );
    }

    if (input.explicitSingleProvider) {
      throw error;
    }

    ports.logProviderFailure({
      durationMs: Date.now() - providerStartedAt,
      errorCode,
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
      failure: `${provider}:${errorCode}`,
      provider,
    };
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}
