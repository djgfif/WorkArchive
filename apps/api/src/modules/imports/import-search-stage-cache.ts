import { createHash } from 'node:crypto';
import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type {
  ImportSearchDiagnosticReasonCode,
  ImportSearchDiagnosticStatus,
} from './diagnostics/import-search-diagnostics';
import type { ImportProvider } from './imports.constants';
import { isRecord } from './providers/import-candidate-readers';
import type { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';

export const IMPORT_SEARCH_STAGE_CACHE_TTL_MS = 60_000;

export interface ImportProviderSearchResult {
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

export interface CachedImportSearchStage {
  providerResults: ImportProviderSearchResult[];
}

export function canCacheImportSearchStage(results: ImportProviderSearchResult[]) {
  return results.every((result) => result.diagnostic.status === 'searched');
}

export async function readCachedImportSearchStage(
  providerRuntimeState: Pick<ProviderRuntimeStateService, 'readCache'>,
  cacheKey: string,
) {
  const cached = await providerRuntimeState.readCache(cacheKey);

  return isCachedImportSearchStage(cached) ? cached : null;
}

export function buildImportSearchStageCacheKey(input: {
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
