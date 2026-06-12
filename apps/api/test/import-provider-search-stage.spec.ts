import { WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import {
  runImportProviderSearchStage,
  type ImportProviderSearchStagePorts,
} from '../src/modules/imports/import-provider-search-stage';
import type { ImportProviderSearchResult } from '../src/modules/imports/import-search-stage-cache';
import {
  ALADIN_PROVIDER,
  MANUAL_PROVIDER,
} from '../src/modules/imports/imports.constants';
import type { ImportProviderSearchRuntime } from '../src/modules/imports/providers/import-provider-search';
import type { ProviderCircuitStatus } from '../src/modules/imports/runtime/provider-runtime-state.service';

const CLOSED_CIRCUIT_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: null,
  circuitReasonCode: null,
  circuitState: 'closed',
};

function searchRuntime(
  overrides: Partial<ImportProviderSearchRuntime> = {},
): ImportProviderSearchRuntime {
  return {
    fetchJson: jest.fn(async () => ({})),
    getProviderCredentialValues: jest.fn(async () => null),
    getProviderCredentialValuesWithFallback: jest.fn(async () => null),
    getSearchProviderCredentialValues: jest.fn(async () => null),
    getSearchProviderCredentialValuesWithFallback: jest.fn(async () => null),
    ...overrides,
  };
}

function ports(
  overrides: Partial<ImportProviderSearchStagePorts> = {},
): ImportProviderSearchStagePorts {
  return {
    isProviderConfigured: jest.fn(async () => true),
    logProviderFailure: jest.fn(),
    providerRuntimeState: {
      getCircuitStatus: jest.fn(async () => CLOSED_CIRCUIT_STATUS),
      isCircuitOpen: jest.fn(async () => false),
      readCache: jest.fn(async () => null),
      recordFailure: jest.fn(async () => undefined),
      recordSuccess: jest.fn(async () => undefined),
      writeCache: jest.fn(async () => undefined),
    },
    searchRuntime: searchRuntime(),
    ...overrides,
  };
}

const cachedProviderResult: ImportProviderSearchResult = {
  candidates: [],
  diagnostic: {
    configured: true,
    message: 'Manual fallback search completed.',
    reasonCode: null,
    resultCount: 1,
    status: 'searched',
  },
  failure: null,
  provider: MANUAL_PROVIDER,
};

describe('runImportProviderSearchStage', () => {
  it('returns cached provider results without searching', async () => {
    const stagePorts = ports({
      providerRuntimeState: {
        ...ports().providerRuntimeState,
        readCache: jest.fn(async () => ({
          providerResults: [cachedProviderResult],
        })),
      },
    });

    await expect(
      runImportProviderSearchStage({
        explicitSingleProvider: false,
        limit: 5,
        mediumType: WorkType.novel,
        ports: stagePorts,
        providers: [MANUAL_PROVIDER],
        query: 'Dune',
        resolvedProviders: [MANUAL_PROVIDER],
        userId: null,
      }),
    ).resolves.toEqual([cachedProviderResult]);
    expect(stagePorts.providerRuntimeState.recordSuccess).not.toHaveBeenCalled();
    expect(stagePorts.providerRuntimeState.writeCache).not.toHaveBeenCalled();
  });

  it('writes searched provider results to the stage cache', async () => {
    const stagePorts = ports();

    const results = await runImportProviderSearchStage({
      explicitSingleProvider: false,
      limit: 5,
      mediumType: WorkType.novel,
      ports: stagePorts,
      providers: [MANUAL_PROVIDER],
      query: 'Dune',
      resolvedProviders: [MANUAL_PROVIDER],
      userId: 'user-1',
    });

    expect(results).toEqual([
      expect.objectContaining({
        diagnostic: expect.objectContaining({
          status: 'searched',
        }),
        provider: MANUAL_PROVIDER,
      }),
    ]);
    expect(stagePorts.providerRuntimeState.writeCache).toHaveBeenCalledWith(
      expect.stringMatching(/^imports:search-stage:/),
      { providerResults: results },
      60_000,
    );
  });

  it('does not cache skipped provider results', async () => {
    const stagePorts = ports();

    const results = await runImportProviderSearchStage({
      explicitSingleProvider: false,
      limit: 5,
      mediumType: WorkType.novel,
      ports: stagePorts,
      providers: [],
      query: 'Dune',
      resolvedProviders: [ALADIN_PROVIDER],
      userId: null,
    });

    expect(results).toEqual([
      expect.objectContaining({
        diagnostic: expect.objectContaining({
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        provider: ALADIN_PROVIDER,
      }),
    ]);
    expect(stagePorts.providerRuntimeState.writeCache).not.toHaveBeenCalled();
  });
});
