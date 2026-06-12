import { WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import {
  searchImportProviderForQuery,
  type ImportProviderSearchRunnerPorts,
} from '../src/modules/imports/import-provider-search-runner';
import {
  ALADIN_PROVIDER,
  MANUAL_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  type ImportProvider,
} from '../src/modules/imports/imports.constants';
import type { ImportProviderSearchRuntime } from '../src/modules/imports/providers/import-provider-search';
import type { ProviderCircuitStatus } from '../src/modules/imports/runtime/provider-runtime-state.service';

const CLOSED_CIRCUIT_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: null,
  circuitReasonCode: null,
  circuitState: 'closed',
};

const OPEN_CIRCUIT_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: '2026-06-12T00:00:00.000Z',
  circuitReasonCode: 'provider_failed',
  circuitState: 'open',
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
  overrides: Partial<ImportProviderSearchRunnerPorts> = {},
): ImportProviderSearchRunnerPorts {
  return {
    isProviderConfigured: jest.fn(async () => true),
    logProviderFailure: jest.fn(),
    providerRuntimeState: {
      getCircuitStatus: jest.fn(async () => CLOSED_CIRCUIT_STATUS),
      isCircuitOpen: jest.fn(async () => false),
      recordFailure: jest.fn(async () => undefined),
      recordSuccess: jest.fn(async () => undefined),
    },
    searchRuntime: searchRuntime(),
    ...overrides,
  };
}

function searchInput(
  provider: ImportProvider,
  input: Partial<Parameters<typeof searchImportProviderForQuery>[0]> = {},
): Parameters<typeof searchImportProviderForQuery>[0] {
  return {
    explicitSingleProvider: false,
    limit: 5,
    mediumType: WorkType.novel,
    ports: ports(),
    provider,
    providers: [provider],
    query: 'Dune',
    userId: 'user-1',
    ...input,
  };
}

describe('searchImportProviderForQuery', () => {
  it('skips providers that do not support the selected medium', async () => {
    const runnerPorts = ports();

    await expect(
      searchImportProviderForQuery(
        searchInput(OPEN_LIBRARY_PROVIDER, {
          mediumType: WorkType.movie,
          ports: runnerPorts,
        }),
      ),
    ).resolves.toEqual({
      candidates: [],
      diagnostic: expect.objectContaining({
        configured: true,
        reasonCode: 'unsupported_medium',
        resultCount: 0,
        status: 'skipped',
      }),
      failure: null,
      provider: OPEN_LIBRARY_PROVIDER,
    });
    expect(runnerPorts.providerRuntimeState.isCircuitOpen).not.toHaveBeenCalled();
  });

  it('skips user-key providers excluded from guest-allowed providers', async () => {
    const runnerPorts = ports();

    await expect(
      searchImportProviderForQuery(
        searchInput(ALADIN_PROVIDER, {
          ports: runnerPorts,
          providers: [],
          userId: null,
        }),
      ),
    ).resolves.toEqual({
      candidates: [],
      diagnostic: expect.objectContaining({
        reasonCode: 'guest_provider_not_allowed',
        status: 'skipped',
      }),
      failure: null,
      provider: ALADIN_PROVIDER,
    });
  });

  it('returns searched results and records circuit success', async () => {
    const runnerPorts = ports();

    const result = await searchImportProviderForQuery(
      searchInput(MANUAL_PROVIDER, {
        mediumType: WorkType.novel,
        ports: runnerPorts,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        diagnostic: expect.objectContaining({
          reasonCode: null,
          resultCount: 1,
          status: 'searched',
        }),
        failure: null,
        provider: MANUAL_PROVIDER,
      }),
    );
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: MANUAL_PROVIDER,
        title: 'Dune',
      }),
    );
    expect(runnerPorts.providerRuntimeState.recordSuccess).toHaveBeenCalledWith(
      MANUAL_PROVIDER,
    );
  });

  it('skips search when the provider circuit is open', async () => {
    const runnerPorts = ports({
      providerRuntimeState: {
        getCircuitStatus: jest.fn(async () => OPEN_CIRCUIT_STATUS),
        isCircuitOpen: jest.fn(async () => true),
        recordFailure: jest.fn(async () => undefined),
        recordSuccess: jest.fn(async () => undefined),
      },
    });

    await expect(
      searchImportProviderForQuery(
        searchInput(MANUAL_PROVIDER, {
          ports: runnerPorts,
        }),
      ),
    ).resolves.toEqual({
      candidates: [],
      diagnostic: expect.objectContaining({
        reasonCode: 'circuit_open',
        resultCount: 0,
        status: 'skipped',
      }),
      failure: null,
      provider: MANUAL_PROVIDER,
    });
    expect(runnerPorts.providerRuntimeState.recordSuccess).not.toHaveBeenCalled();
  });

  it('records provider failure details for non-explicit searches', async () => {
    const fetchError = new Error('upstream failed');
    const runnerPorts = ports({
      metricsService: {
        recordImportsProviderCircuitOpen: jest.fn(),
        recordImportsProviderFailure: jest.fn(),
      },
      providerRuntimeState: {
        getCircuitStatus: jest.fn(async () => OPEN_CIRCUIT_STATUS),
        isCircuitOpen: jest.fn(async () => false),
        recordFailure: jest.fn(async () => undefined),
        recordSuccess: jest.fn(async () => undefined),
      },
      searchRuntime: searchRuntime({
        fetchJson: jest.fn(async () => {
          throw fetchError;
        }),
      }),
    });

    await expect(
      searchImportProviderForQuery(
        searchInput(OPEN_LIBRARY_PROVIDER, {
          ports: runnerPorts,
        }),
      ),
    ).resolves.toEqual({
      candidates: [],
      diagnostic: expect.objectContaining({
        reasonCode: 'provider_failed',
        resultCount: 0,
        status: 'failed',
      }),
      failure: 'open_library:Error',
      provider: OPEN_LIBRARY_PROVIDER,
    });

    expect(runnerPorts.providerRuntimeState.recordFailure).toHaveBeenCalledWith(
      OPEN_LIBRARY_PROVIDER,
      3,
      60_000,
    );
    expect(
      runnerPorts.metricsService?.recordImportsProviderFailure,
    ).toHaveBeenCalledWith(OPEN_LIBRARY_PROVIDER, 'Error');
    expect(
      runnerPorts.metricsService?.recordImportsProviderCircuitOpen,
    ).toHaveBeenCalledWith(OPEN_LIBRARY_PROVIDER, 'provider_failed');
    expect(runnerPorts.logProviderFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'Error',
        provider: OPEN_LIBRARY_PROVIDER,
        userId: 'user-1',
      }),
    );
  });

  it('rethrows provider failures for explicit single-provider searches', async () => {
    const fetchError = new Error('upstream failed');
    const runnerPorts = ports({
      searchRuntime: searchRuntime({
        fetchJson: jest.fn(async () => {
          throw fetchError;
        }),
      }),
    });

    await expect(
      searchImportProviderForQuery(
        searchInput(OPEN_LIBRARY_PROVIDER, {
          explicitSingleProvider: true,
          ports: runnerPorts,
        }),
      ),
    ).rejects.toBe(fetchError);
  });
});
