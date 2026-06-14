import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import {
  deleteImportProviderKey,
  saveImportProviderKey,
  testImportProviderKey,
  type ImportProviderCredentialStore,
} from '../src/modules/imports/import-provider-key-management';
import {
  ALADIN_PROVIDER,
  MANUAL_PROVIDER,
  TMDB_PROVIDER,
} from '../src/modules/imports/imports.constants';
import type { ProviderCircuitStatus } from '../src/modules/imports/runtime/provider-runtime-state.service';

const CLOSED_CIRCUIT_STATUS: ProviderCircuitStatus = {
  circuitOpenedUntil: null,
  circuitReasonCode: null,
  circuitState: 'closed',
};

function credentialStore(
  overrides: Partial<ImportProviderCredentialStore> = {},
): ImportProviderCredentialStore {
  return {
    deleteCredential: jest.fn(async () => undefined),
    getDecryptedCredential: jest.fn(async () => null),
    saveCredential: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('import provider key management', () => {
  it('normalizes, saves, and returns provider status', async () => {
    const store = credentialStore();
    const getCircuitStatus = jest.fn(
      async (_provider: string) => CLOSED_CIRCUIT_STATUS,
    );

    await expect(
      saveImportProviderKey({
        credentialStore: store,
        getCircuitStatus,
        providerInput: TMDB_PROVIDER,
        userId: 'user-1',
        values: {
          readToken: ' token-value ',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        configured: true,
        provider: TMDB_PROVIDER,
      }),
    );

    expect(store.saveCredential).toHaveBeenCalledWith(
      'user-1',
      TMDB_PROVIDER,
      JSON.stringify({ readToken: 'token-value' }),
    );
    expect(getCircuitStatus).toHaveBeenCalledWith(TMDB_PROVIDER);
  });

  it('rejects providers that do not accept user keys', async () => {
    await expect(
      saveImportProviderKey({
        credentialStore: credentialStore(),
        getCircuitStatus: jest.fn(async () => CLOSED_CIRCUIT_STATUS),
        providerInput: MANUAL_PROVIDER,
        userId: 'user-1',
        values: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes a normalized provider key', async () => {
    const store = credentialStore();

    await deleteImportProviderKey({
      credentialStore: store,
      providerInput: ALADIN_PROVIDER,
      userId: 'user-1',
    });

    expect(store.deleteCredential).toHaveBeenCalledWith(
      'user-1',
      ALADIN_PROVIDER,
    );
  });

  it('reports missing credentials without calling the provider', async () => {
    const fetchJson = jest.fn(async () => ({}));

    await expect(
      testImportProviderKey({
        checkedAt: '2026-06-12T00:00:00.000Z',
        credentialReader: credentialStore(),
        fetchJson,
        providerInput: ALADIN_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      checkedAt: '2026-06-12T00:00:00.000Z',
      message: 'Aladin Book API key is not configured.',
      ok: false,
      provider: ALADIN_PROVIDER,
      reason: 'missing_key',
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('reports successful provider key checks', async () => {
    const fetchJson = jest.fn(async () => ({}));

    await expect(
      testImportProviderKey({
        checkedAt: '2026-06-12T00:00:00.000Z',
        credentialReader: credentialStore({
          getDecryptedCredential: jest.fn(async () =>
            JSON.stringify({ ttbKey: 'ttb-test-key' }),
          ),
        }),
        fetchJson,
        providerInput: ALADIN_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      checkedAt: '2026-06-12T00:00:00.000Z',
      message: 'Aladin Book API key connection test succeeded.',
      ok: true,
      provider: ALADIN_PROVIDER,
      reason: null,
    });
    expect(fetchJson).toHaveBeenCalled();
  });

  it('classifies provider key check failures', async () => {
    await expect(
      testImportProviderKey({
        checkedAt: '2026-06-12T00:00:00.000Z',
        credentialReader: credentialStore({
          getDecryptedCredential: jest.fn(async () =>
            JSON.stringify({ ttbKey: 'ttb-test-key' }),
          ),
        }),
        fetchJson: jest.fn(async () => {
          throw new BadGatewayException('upstream failed');
        }),
        providerInput: ALADIN_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      checkedAt: '2026-06-12T00:00:00.000Z',
      message: 'Aladin Book provider is temporarily unavailable.',
      ok: false,
      provider: ALADIN_PROVIDER,
      reason: 'provider_unavailable',
    });
  });
});
