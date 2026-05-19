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
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    EXTERNAL_API_KEY_ENCRYPTION_SECRET:
      'test-external-api-key-encryption-secret-minimum-32-chars',
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
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_ACCESS_SECRET must be changed from the development default in production.',
    );
  });

  it('blocks the local compose access token secret in production', () => {
    resetEnv({
      JWT_ACCESS_SECRET: 'local-compose-access-secret-minimum-32-chars',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_ACCESS_SECRET must be changed from the development default in production.',
    );
  });

  it('blocks the default refresh token secret in production', () => {
    resetEnv({
      JWT_REFRESH_SECRET: 'change-me-refresh-secret',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_REFRESH_SECRET must be changed from the development default in production.',
    );
  });

  it('blocks short production secrets', () => {
    resetEnv({
      JWT_ACCESS_SECRET: 'short-production-secret',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_ACCESS_SECRET must be at least 32 characters in production.',
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

  it('blocks insecure production feature toggles', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
      SWAGGER_ENABLED: 'true',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'SWAGGER_ENABLED must not be true in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
      PASSWORD_RESET_DEV_LINKS_ENABLED: 'true',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PASSWORD_RESET_DEV_LINKS_ENABLED must not be true in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
      COOKIE_SECURE: 'false',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'COOKIE_SECURE must not be false in production.',
    );
  });

  it('blocks localhost CORS and missing web base url in production', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'http://localhost:8080',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'CORS_ORIGIN must not use localhost in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: '',
      PUBLIC_WEB_BASE_URL: '',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WEB_BASE_URL must be configured in production.',
    );
  });

  it('blocks development database and seed defaults in production', () => {
    resetEnv({
      DATABASE_URL:
        'postgresql://postgres:postgres@postgres:5432/work_archive?schema=public',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'DATABASE_URL must not use the postgres/postgres development credential in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      SEED_DEMO_PASSWORD: 'demo-password-123',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'SEED_DEMO_PASSWORD must not use the demo password in production.',
    );
  });

  it('requires an external rate limit store in production', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'RATE_LIMIT_STORE must be set to "external" in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      RATE_LIMIT_STORE: 'memory',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'RATE_LIMIT_STORE must not be "memory" in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      RATE_LIMIT_STORE: 'external',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        rateLimitStore: 'external',
      }),
    );
  });
});
