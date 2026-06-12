import { WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import {
  buildImportSearchStageCacheKey,
  canCacheImportSearchStage,
  readCachedImportSearchStage,
  type ImportProviderSearchResult,
} from '../src/modules/imports/import-search-stage-cache';
import {
  GOOGLE_BOOKS_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../src/modules/imports/imports.constants';

function providerResult(
  status: ImportProviderSearchResult['diagnostic']['status'],
): ImportProviderSearchResult {
  return {
    candidates: [],
    diagnostic: {
      configured: true,
      message: 'done',
      reasonCode: null,
      resultCount: 0,
      status,
    },
    failure: null,
    provider: GOOGLE_BOOKS_PROVIDER,
  };
}

describe('import search stage cache', () => {
  it('builds stable keys from normalized query text', () => {
    const base = {
      limit: 10,
      mediumType: WorkType.novel,
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      userId: 'user-1',
    };

    expect(
      buildImportSearchStageCacheKey({
        ...base,
        query: ' DUNE ',
      }),
    ).toBe(
      buildImportSearchStageCacheKey({
        ...base,
        query: 'dune',
      }),
    );
  });

  it('caches only fully searched provider stages', () => {
    expect(canCacheImportSearchStage([providerResult('searched')])).toBe(true);
    expect(canCacheImportSearchStage([providerResult('skipped')])).toBe(false);
    expect(canCacheImportSearchStage([providerResult('failed')])).toBe(false);
  });

  it('returns cached stages only when the payload shape is valid', async () => {
    type ReadCache = (cacheKey: string) => Promise<unknown>;

    const validStage = {
      providerResults: [providerResult('searched')],
    };
    const runtime = {
      readCache: jest.fn<ReadCache>(async () => validStage),
    };

    await expect(readCachedImportSearchStage(runtime, 'cache-key')).resolves.toBe(
      validStage,
    );

    runtime.readCache.mockResolvedValueOnce({ providerResults: [{ bad: true }] });

    await expect(readCachedImportSearchStage(runtime, 'cache-key')).resolves.toBe(
      null,
    );
  });
});
