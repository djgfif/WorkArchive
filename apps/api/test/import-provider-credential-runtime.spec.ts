import { describe, expect, it, jest } from '@jest/globals';

import {
  buildImportProviderCredentialRuntime,
  readImportProviderCredentialValues,
  readImportProviderCredentialValuesWithFallback,
  readImportSearchCredentialValues,
  readImportSearchCredentialValuesWithFallback,
  type ImportProviderCredentialReader,
} from '../src/modules/imports/import-provider-credential-runtime';
import {
  ALADIN_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  TMDB_PROVIDER,
  type ImportProvider,
} from '../src/modules/imports/imports.constants';

const ENV_KEYS = [
  'KAKAO_REST_API_KEY',
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
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

function credentialReader(
  getDecryptedCredential: ImportProviderCredentialReader['getDecryptedCredential'],
): ImportProviderCredentialReader {
  return {
    getDecryptedCredential,
  };
}

describe('import provider credential runtime', () => {
  it('parses stored JSON credential values', async () => {
    const reader = credentialReader(
      jest.fn(async () =>
        JSON.stringify({
          readToken: ' tmdb-read-token ',
        }),
      ),
    );

    await expect(
      readImportProviderCredentialValues({
        credentialReader: reader,
        provider: TMDB_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      readToken: 'tmdb-read-token',
    });
  });

  it('keeps legacy Aladin raw key parsing compatible', async () => {
    const reader = credentialReader(jest.fn(async () => ' raw-ttb-key '));

    await expect(
      readImportProviderCredentialValues({
        credentialReader: reader,
        provider: ALADIN_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      ttbKey: 'raw-ttb-key',
    });
  });

  it('falls back to sibling provider credentials when the primary is empty', async () => {
    const getDecryptedCredential = jest.fn(
      async (_userId: string, provider: ImportProvider) =>
        provider === NAVER_BOOK_PROVIDER
          ? JSON.stringify({
              clientId: 'naver-client',
              clientSecret: 'naver-secret',
            })
          : null,
    );

    await expect(
      readImportProviderCredentialValuesWithFallback({
        credentialReader: credentialReader(getDecryptedCredential),
        fallbackProvider: NAVER_BOOK_PROVIDER,
        provider: NAVER_WEB_PROVIDER,
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      clientId: 'naver-client',
      clientSecret: 'naver-secret',
    });
  });

  it('uses server search credentials before stored user credentials', async () => {
    const getDecryptedCredential = jest.fn(async () =>
      JSON.stringify({
        readToken: 'user-token',
      }),
    );

    await withEnv(
      {
        TMDB_API_READ_TOKEN: 'server-token',
      },
      async () => {
        await expect(
          readImportSearchCredentialValues({
            credentialReader: credentialReader(getDecryptedCredential),
            provider: TMDB_PROVIDER,
            userId: 'user-1',
          }),
        ).resolves.toEqual({
          readToken: 'server-token',
        });
      },
    );

    expect(getDecryptedCredential).not.toHaveBeenCalled();
  });

  it('supports server credential fallback for paired web/book providers', async () => {
    const getDecryptedCredential = jest.fn(async () => null);

    await withEnv(
      {
        KAKAO_REST_API_KEY: 'server-kakao-key',
      },
      async () => {
        await expect(
          readImportSearchCredentialValuesWithFallback({
            credentialReader: credentialReader(getDecryptedCredential),
            fallbackProvider: KAKAO_BOOK_PROVIDER,
            provider: KAKAO_WEB_PROVIDER,
            userId: null,
          }),
        ).resolves.toEqual({
          restApiKey: 'server-kakao-key',
        });
      },
    );
  });

  it('builds provider search runtime credential accessors', async () => {
    const runtime = buildImportProviderCredentialRuntime({
      credentialReader: credentialReader(
        jest.fn(async () =>
          JSON.stringify({
            clientId: 'naver-client',
            clientSecret: 'naver-secret',
          }),
        ),
      ),
      fetchJson: jest.fn(async () => ({})),
    });

    await expect(
      runtime.getProviderCredentialValues('user-1', NAVER_BOOK_PROVIDER),
    ).resolves.toEqual({
      clientId: 'naver-client',
      clientSecret: 'naver-secret',
    });
  });
});
