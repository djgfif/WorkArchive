import { describe, expect, it, jest } from '@jest/globals';

import {
  buildImportProviderStatus,
  isImportProviderConfigured,
  type ImportProviderReadinessCredentialStore,
} from '../src/modules/imports/import-provider-readiness';
import {
  BRAVE_SEARCH_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  TMDB_PROVIDER,
} from '../src/modules/imports/imports.constants';

const ENV_KEYS = [
  'KOBIS_API_KEY',
  'KOBIS_HTTP_PROVIDER_ENABLED',
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
  'NODE_ENV',
  'TMDB_API_READ_TOKEN',
] as const;

async function withEnv<T>(
  env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => T | Promise<T>,
) {
  const previous = new Map(
    ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function credentialStore(
  hasCredential: ImportProviderReadinessCredentialStore['hasCredential'],
): ImportProviderReadinessCredentialStore {
  return {
    hasCredential,
  };
}

describe('import provider readiness', () => {
  it('marks no-credential providers configured without reading user credentials', async () => {
    const hasCredential = jest.fn<
      ImportProviderReadinessCredentialStore['hasCredential']
    >();

    await expect(
      isImportProviderConfigured({
        credentialStore: credentialStore(hasCredential),
        provider: MANUAL_PROVIDER,
        userId: null,
      }),
    ).resolves.toBe(true);
    expect(hasCredential).not.toHaveBeenCalled();
  });

  it('marks guest user-key providers unconfigured unless a server credential exists', async () => {
    const hasCredential = jest.fn<
      ImportProviderReadinessCredentialStore['hasCredential']
    >();

    await withEnv(
      {
        TMDB_API_READ_TOKEN: undefined,
      },
      async () => {
        await expect(
          isImportProviderConfigured({
            credentialStore: credentialStore(hasCredential),
            provider: TMDB_PROVIDER,
            userId: null,
          }),
        ).resolves.toBe(false);
      },
    );

    await withEnv(
      {
        TMDB_API_READ_TOKEN: 'server-token',
      },
      async () => {
        await expect(
          isImportProviderConfigured({
            credentialStore: credentialStore(hasCredential),
            provider: TMDB_PROVIDER,
            userId: null,
          }),
        ).resolves.toBe(true);
      },
    );
    expect(hasCredential).not.toHaveBeenCalled();
  });

  it('uses sibling book credentials when checking web search providers', async () => {
    const hasCredential = jest.fn<
      ImportProviderReadinessCredentialStore['hasCredential']
    >(async (_userId, provider) => provider === NAVER_BOOK_PROVIDER);

    await withEnv(
      {
        NAVER_CLIENT_ID: undefined,
        NAVER_CLIENT_SECRET: undefined,
      },
      async () => {
        await expect(
          isImportProviderConfigured({
            credentialStore: credentialStore(hasCredential),
            provider: NAVER_WEB_PROVIDER,
            userId: 'user-1',
          }),
        ).resolves.toBe(true);
      },
    );

    expect(hasCredential).toHaveBeenCalledWith('user-1', NAVER_WEB_PROVIDER);
    expect(hasCredential).toHaveBeenCalledWith('user-1', NAVER_BOOK_PROVIDER);
  });

  it('keeps KOBIS disabled in production unless the HTTP provider flag is explicit', async () => {
    const hasCredential = jest.fn<
      ImportProviderReadinessCredentialStore['hasCredential']
    >();

    await withEnv(
      {
        KOBIS_API_KEY: 'kobis-key',
        KOBIS_HTTP_PROVIDER_ENABLED: undefined,
        NODE_ENV: 'production',
      },
      async () => {
        await expect(
          isImportProviderConfigured({
            credentialStore: credentialStore(hasCredential),
            provider: KOBIS_PROVIDER,
            userId: null,
          }),
        ).resolves.toBe(false);
      },
    );

    await withEnv(
      {
        KOBIS_API_KEY: 'kobis-key',
        KOBIS_HTTP_PROVIDER_ENABLED: 'true',
        NODE_ENV: 'production',
      },
      async () => {
        await expect(
          isImportProviderConfigured({
            credentialStore: credentialStore(hasCredential),
            provider: KOBIS_PROVIDER,
            userId: null,
          }),
        ).resolves.toBe(true);
      },
    );
  });

  it('builds status responses with metadata, credential fields, and circuit state', () => {
    expect(
      buildImportProviderStatus({
        circuitStatus: {
          circuitOpenedUntil: '2026-06-12T00:00:00.000Z',
          circuitReasonCode: 'provider_failed',
          circuitState: 'open',
        },
        configured: false,
        provider: BRAVE_SEARCH_PROVIDER,
      }),
    ).toEqual(
      expect.objectContaining({
        circuitOpenedUntil: '2026-06-12T00:00:00.000Z',
        circuitReasonCode: 'provider_failed',
        circuitState: 'open',
        configured: false,
        credentialFields: [
          {
            description: 'Brave Search API key',
            label: 'API Key',
            name: 'apiKey',
            secret: true,
          },
        ],
        credentialMode: 'user',
        provider: BRAVE_SEARCH_PROVIDER,
      }),
    );
  });
});
