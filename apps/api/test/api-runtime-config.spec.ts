import { afterEach, describe, expect, it } from '@jest/globals';

import {
  readApiRuntimeConfig,
  readExternalApiKeyEncryptionSecret,
} from '../src/config/api-runtime-config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://work:archive@localhost:5432/work_archive',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    EXTERNAL_API_KEY_ENCRYPTION_SECRET:
      'test-external-api-key-encryption-secret',
    ...overrides,
  };
}

describe('api runtime config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('allows development default secrets outside production', () => {
    resetEnv({
      EXTERNAL_API_KEY_ENCRYPTION_SECRET:
        'change-me-external-api-key-encryption-secret',
      JWT_ACCESS_SECRET: 'change-me-access-secret',
      JWT_REFRESH_SECRET: 'change-me-refresh-secret',
      NODE_ENV: 'development',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        jwtAccessSecret: 'change-me-access-secret',
        jwtRefreshSecret: 'change-me-refresh-secret',
      }),
    );
    expect(readExternalApiKeyEncryptionSecret()).toBe(
      'change-me-external-api-key-encryption-secret',
    );
  });

  it('blocks the default access token secret in production', () => {
    resetEnv({
      JWT_ACCESS_SECRET: 'change-me-access-secret',
      NODE_ENV: 'production',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_ACCESS_SECRET must be changed from the development default in production.',
    );
  });

  it('blocks the default refresh token secret in production', () => {
    resetEnv({
      JWT_REFRESH_SECRET: 'change-me-refresh-secret',
      NODE_ENV: 'production',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_REFRESH_SECRET must be changed from the development default in production.',
    );
  });

  it('blocks the default external API key encryption secret in production', () => {
    resetEnv({
      EXTERNAL_API_KEY_ENCRYPTION_SECRET:
        'change-me-external-api-key-encryption-secret',
      NODE_ENV: 'production',
    });

    expect(() => readExternalApiKeyEncryptionSecret()).toThrow(
      'EXTERNAL_API_KEY_ENCRYPTION_SECRET must be changed from the development default in production.',
    );
  });
});
