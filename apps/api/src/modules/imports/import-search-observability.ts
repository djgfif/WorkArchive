import type { WorkType } from '@prisma/client';

import type { MetricsService } from '../../observability/metrics.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportSearchDiagnostics } from './diagnostics/import-search-diagnostics';
import type { ImportProviderSearchResult } from './import-search-stage-cache';
import { PROVIDERS } from './providers/import-provider-adapter';

export interface ImportSearchLogger {
  log(message: string): void;
  warn(message: string): void;
}

export interface ImportProviderFailureLogFields {
  count?: number;
  durationMs?: number;
  entityType?: string;
  errorCode?: string;
  provider?: string;
  requestId?: string;
  userId?: string | undefined;
}

export function collectImportProviderSearchResults(
  providerResults: ImportProviderSearchResult[],
): {
  candidates: ImportCandidateResponseDto[];
  diagnostics: ImportSearchDiagnostics;
  failures: string[];
} {
  return {
    candidates: providerResults.flatMap((result) => result.candidates),
    diagnostics: {
      providers: providerResults.map((result) => ({
        configured: result.diagnostic.configured,
        credentialMode: PROVIDERS[result.provider].credentialMode,
        message: result.diagnostic.message,
        provider: result.provider,
        reasonCode: result.diagnostic.reasonCode,
        resultCount: result.diagnostic.resultCount,
        status: result.diagnostic.status,
      })),
    },
    failures: providerResults.flatMap((result) =>
      result.failure ? [result.failure] : [],
    ),
  };
}

export function getImportSearchResultStatus(failures: string[]) {
  return failures.length > 0 ? 'partial' : 'ok';
}

export function getImportSearchSummaryStatus(failures: string[]) {
  return failures.length > 0 ? `partial:${failures.join('|')}` : 'ok';
}

export function logImportProviderFailure(
  logger: ImportSearchLogger,
  fields: ImportProviderFailureLogFields,
) {
  logger.warn(
    JSON.stringify({
      count: fields.count ?? null,
      durationMs: fields.durationMs ?? null,
      entityType: fields.entityType ?? null,
      errorCode: fields.errorCode ?? null,
      event: 'imports.provider.failed',
      provider: fields.provider ?? null,
      requestId: fields.requestId ?? null,
      userId: fields.userId ?? null,
    }),
  );
}

export function logImportSearchSummary(
  logger: ImportSearchLogger,
  input: {
    provider: string;
    query: string;
    resultCount: number;
    status: string;
    userId: string | null;
  },
) {
  logger.log(
    `Import search summary userId=${input.userId ?? 'guest'} provider=${input.provider} queryLength=${input.query.length} resultCount=${input.resultCount} status=${input.status}`,
  );
}

export function recordImportSearchMetric(input: {
  endedAt?: bigint;
  mediumType: WorkType | undefined;
  metricsService?: Pick<MetricsService, 'recordImportsSearch'> | undefined;
  providerCount: number;
  result: string;
  startedAt: bigint;
  userId: string | null;
}) {
  input.metricsService?.recordImportsSearch(
    {
      auth_scope: input.userId ? 'user' : 'guest',
      medium_type: input.mediumType ?? 'all',
      provider_count: input.providerCount.toString(),
      result: input.result,
    },
    Number((input.endedAt ?? process.hrtime.bigint()) - input.startedAt) /
      1_000_000_000,
  );
}
