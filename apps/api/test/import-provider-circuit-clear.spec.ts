import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  assertImportProviderCircuitClearCanRun,
  formatImportProviderCircuitClearFailure,
  readImportProviderCircuitClearConfig,
  runImportProviderCircuitClear,
  type ImportProviderCircuitRuntime,
} from '../src/operations/import-provider-circuit-clear';
import type { ProviderCircuitStatus } from '../src/modules/imports/runtime/provider-runtime-state.service';

const CLOSED_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: null,
  circuitReasonCode: null,
  circuitState: 'closed' as const,
};

const OPEN_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: '2026-06-20T09:00:00.000Z',
  circuitReasonCode: 'provider_failed' as const,
  circuitState: 'open' as const,
};

describe('import provider circuit clear operation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads a dry-run provider config from env by default', () => {
    expect(
      readImportProviderCircuitClearConfig({
        IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
        REDIS_URL: 'redis://redis:6379',
      }),
    ).toEqual({
      dryRun: true,
      productionConfirmation: null,
      provider: 'wikidata',
      redisUrl: 'redis://redis:6379',
    });
  });

  it('reads the provider from the first command argument when env is absent', () => {
    expect(readImportProviderCircuitClearConfig({}, 'open_library')).toEqual(
      expect.objectContaining({
        provider: 'open_library',
      }),
    );
  });

  it('rejects unsupported providers before touching runtime state', () => {
    expect(() =>
      readImportProviderCircuitClearConfig({
        IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'unknown',
      }),
    ).toThrow(/Unsupported import provider/);
  });

  it('rejects invalid dry-run boolean values before touching runtime state', () => {
    expect(() =>
      readImportProviderCircuitClearConfig({
        IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: 'flase',
        IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
      }),
    ).toThrow(/IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN must be true or false/);

    for (const value of ['1', '0', 'yes', 'no', 'on', 'off']) {
      expect(() =>
        readImportProviderCircuitClearConfig({
          IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: value,
          IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
        }),
      ).toThrow(/IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN must be true or false/);
    }
  });

  it('requires Redis before a real clear because memory state is process-local', () => {
    const config = readImportProviderCircuitClearConfig({
      IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: 'false',
      IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
    });

    expect(() => assertImportProviderCircuitClearCanRun(config)).toThrow(
      /REDIS_URL/,
    );
  });

  it('requires an explicit confirmation phrase for production real clears', () => {
    const config = readImportProviderCircuitClearConfig({
      IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: 'false',
      IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
      REDIS_URL: 'redis://redis:6379',
    });

    expect(() =>
      assertImportProviderCircuitClearCanRun(config, {
        NODE_ENV: 'production',
      }),
    ).toThrow(/IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM/);
  });

  it('allows production real clears only with the explicit confirmation phrase', () => {
    const config = readImportProviderCircuitClearConfig({
      IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM: 'clear-import-provider-circuit',
      IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: 'false',
      IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
      REDIS_URL: 'redis://redis:6379',
    });

    expect(() =>
      assertImportProviderCircuitClearCanRun(config, {
        NODE_ENV: 'production',
      }),
    ).not.toThrow();
  });

  it('dry-runs without Redis without reading process-local state', async () => {
    const runtime = createRuntimeMock();
    const config = readImportProviderCircuitClearConfig({
      IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
    });

    await expect(runImportProviderCircuitClear(runtime, config)).resolves.toEqual({
      cleared: false,
      dryRun: true,
      provider: 'wikidata',
      redisConfigured: false,
      statusAfter: null,
      statusBefore: null,
    });
    expect(runtime.getCircuitStatus).not.toHaveBeenCalled();
    expect(runtime.clearCircuit).not.toHaveBeenCalled();
  });

  it('clears a Redis-backed provider circuit and reports before/after state', async () => {
    const runtime = createRuntimeMock([OPEN_STATUS, CLOSED_STATUS]);
    const config = readImportProviderCircuitClearConfig({
      IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN: 'false',
      IMPORT_PROVIDER_CIRCUIT_PROVIDER: 'wikidata',
      REDIS_URL: 'redis://redis:6379',
    });

    await expect(runImportProviderCircuitClear(runtime, config)).resolves.toEqual({
      cleared: true,
      dryRun: false,
      provider: 'wikidata',
      redisConfigured: true,
      statusAfter: CLOSED_STATUS,
      statusBefore: OPEN_STATUS,
    });
    expect(runtime.clearCircuit).toHaveBeenCalledWith('wikidata');
  });

  it('formats operation failures without raw Redis or token errors', () => {
    const formatted = formatImportProviderCircuitClearFailure(
      new Error('REDIS_URL=redis://:secret access_token raw payload'),
    );

    expect(JSON.parse(formatted)).toEqual({
      errorCode: 'Error',
      event: 'operations.import_provider_circuit.clear_failed',
    });
    expect(formatted).not.toContain('REDIS_URL');
    expect(formatted).not.toContain('redis://:secret');
    expect(formatted).not.toContain('access_token');
    expect(formatted).not.toContain('raw payload');
  });
});

function createRuntimeMock(
  statuses: ProviderCircuitStatus[] = [CLOSED_STATUS],
): jest.Mocked<ImportProviderCircuitRuntime> {
  return {
    clearCircuit: jest.fn(async () => undefined),
    getCircuitStatus: jest.fn(async () => statuses.shift() ?? CLOSED_STATUS),
  };
}
