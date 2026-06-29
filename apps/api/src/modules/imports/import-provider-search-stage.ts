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

export const DEFAULT_IMPORT_PROVIDER_SEARCH_CONCURRENCY = 3;

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
  providerConcurrency?: number;
  providers: ImportProvider[];
  query: string;
  requestId?: string;
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

  const providerResults = await runImportProviderSearchTasksWithConcurrency(
    input.resolvedProviders.map((provider) => {
      return () =>
        searchImportProviderForQuery({
          explicitSingleProvider: input.explicitSingleProvider,
          limit: input.limit,
          mediumType: input.mediumType,
          ports: input.ports,
          provider,
          providers: input.providers,
          query: input.query,
          ...(input.requestId ? { requestId: input.requestId } : {}),
          userId: input.userId,
        });
    }),
    input.providerConcurrency ?? DEFAULT_IMPORT_PROVIDER_SEARCH_CONCURRENCY,
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

export async function runImportProviderSearchTasksWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(
      'Import provider search concurrency must be a positive integer.',
    );
  }

  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;

      nextIndex += 1;
      const task = tasks[taskIndex];

      if (!task) {
        throw new Error('Import provider search task index is out of range.');
      }

      results[taskIndex] = await task();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, tasks.length) },
      () => worker(),
    ),
  );

  return results;
}
