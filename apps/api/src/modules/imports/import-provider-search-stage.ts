import type { WorkType } from '@prisma/client';

import type { ImportProvider } from './imports.constants';
import {
  IMPORT_SEARCH_STAGE_CACHE_TTL_MS,
  buildImportSearchStageCacheKey,
  canCacheImportSearchStage,
  readCachedImportSearchStage,
  type CachedImportSearchStage,
  type ImportProviderSearchResult,
} from './import-search-stage-cache';
import {
  searchImportProviderForQuery,
  type ImportProviderSearchRunnerPorts,
} from './import-provider-search-runner';
import type { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';

export interface ImportProviderSearchStagePorts
  extends ImportProviderSearchRunnerPorts {
  providerRuntimeState: ImportProviderSearchRunnerPorts['providerRuntimeState'] &
    Pick<ProviderRuntimeStateService, 'readCache' | 'writeCache'>;
}

export async function runImportProviderSearchStage(input: {
  explicitSingleProvider: boolean;
  limit: number;
  mediumType: WorkType | undefined;
  ports: ImportProviderSearchStagePorts;
  providers: ImportProvider[];
  query: string;
  resolvedProviders: ImportProvider[];
  userId: string | null;
}): Promise<ImportProviderSearchResult[]> {
  const cacheKey = input.explicitSingleProvider
    ? null
    : buildImportSearchStageCacheKey({
        limit: input.limit,
        mediumType: input.mediumType,
        providers: input.resolvedProviders,
        query: input.query,
        userId: input.userId,
      });
  const cachedSearchStage = cacheKey
    ? await readCachedImportSearchStage(input.ports.providerRuntimeState, cacheKey)
    : null;

  if (cachedSearchStage) {
    return cachedSearchStage.providerResults;
  }

  const providerResults = await Promise.all(
    input.resolvedProviders.map((provider) =>
      searchImportProviderForQuery({
        explicitSingleProvider: input.explicitSingleProvider,
        limit: input.limit,
        mediumType: input.mediumType,
        ports: input.ports,
        provider,
        providers: input.providers,
        query: input.query,
        userId: input.userId,
      }),
    ),
  );

  if (cacheKey && canCacheImportSearchStage(providerResults)) {
    await input.ports.providerRuntimeState.writeCache(
      cacheKey,
      { providerResults } satisfies CachedImportSearchStage,
      IMPORT_SEARCH_STAGE_CACHE_TTL_MS,
    );
  }

  return providerResults;
}
