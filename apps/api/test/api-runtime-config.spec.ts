import { afterEach, describe, expect, it } from '@jest/globals';

import {
  readApiRuntimeConfig,
  readExternalApiKeyEncryptionSecret,
} from '../src/config/api-runtime-config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv = {}) {
  const productionDefaults =
    overrides.NODE_ENV === 'production'
      ? {
          RATE_LIMIT_STORE: 'redis',
          REDIS_URL: 'redis://redis:6379',
          SECURITY_EVENT_HASH_SECRET:
            'production-security-event-hash-secret-minimum-32-chars',
          TRUST_PROXY_HOPS: '1',
          GOOGLE_OAUTH_REDIRECT_URI:
            'https://workarchive.example.com/api/auth/google/callback',
        }
      : {};

  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://work:archive@localhost:5432/work_archive',
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    EXTERNAL_API_KEY_ENCRYPTION_SECRET:
      'test-external-api-key-encryption-secret-minimum-32-chars',
    ...productionDefaults,
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

  it('allows every supported local web origin when CORS_ORIGIN is omitted in development', () => {
    resetEnv({
      CORS_ORIGIN: '',
      NODE_ENV: 'development',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        clientHeaderGuardMode: 'off',
        corsOrigin: ['http://localhost:18730'],
      }),
    );
  });

  it('defaults the client header guard to audit in production and off elsewhere', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        clientHeaderGuardMode: 'audit',
      }),
    );

    resetEnv({
      NODE_ENV: 'test',
      WORK_ARCHIVE_CLIENT_HEADER_GUARD: '',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        clientHeaderGuardMode: 'off',
      }),
    );
  });

  it('reads explicit client header guard modes and rejects invalid values', () => {
    resetEnv({
      WORK_ARCHIVE_CLIENT_HEADER_GUARD: 'enforce',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        clientHeaderGuardMode: 'enforce',
      }),
    );

    resetEnv({
      WORK_ARCHIVE_CLIENT_HEADER_GUARD: 'block',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be one of "off", "audit", or "enforce".',
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
      COOKIE_SECURE: 'false',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'COOKIE_SECURE must not be false in production.',
    );
  });

  it('blocks localhost CORS and missing web base url in production', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'http://localhost:18730',
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

  it('requires HTTPS for production public web, OAuth redirect, and CORS origins', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'http://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WEB_BASE_URL must use https:// in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      PUBLIC_WEB_BASE_URL: 'http://workarchive.example.com',
      WEB_BASE_URL: '',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PUBLIC_WEB_BASE_URL must use https:// in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_REDIRECT_URI:
        'http://workarchive.example.com/api/auth/google/callback',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_REDIRECT_URI must use https:// in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN:
        'https://workarchive.example.com,http://app.workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'CORS_ORIGIN must use https:// in production.',
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

  it('requires Redis rate limiting and a narrow trust proxy setting in production', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      REDIS_URL: '',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'REDIS_URL must be configured when RATE_LIMIT_STORE is "redis".',
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
      TRUST_PROXY_HOPS: '',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'TRUST_PROXY_HOPS must be configured in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      TRUST_PROXY_HOPS: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'TRUST_PROXY_HOPS must be a positive integer, not a boolean.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      TRUST_PROXY_HOPS: '2',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'TRUST_PROXY_HOPS must be 1 in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        rateLimitPrefix: 'work-archive:rate-limit:',
        rateLimitStore: 'redis',
        redisUrl: 'redis://redis:6379',
        securityEventHashSecret:
          'production-security-event-hash-secret-minimum-32-chars',
        trustProxyHops: 1,
      }),
    );
  });

  it('requires a non-default security audit hash secret in production', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      SECURITY_EVENT_HASH_SECRET: '',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'SECURITY_EVENT_HASH_SECRET must be configured in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      SECURITY_EVENT_HASH_SECRET: 'change-me-security-event-hash-secret',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'SECURITY_EVENT_HASH_SECRET must be changed from the development default in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      SECURITY_EVENT_HASH_SECRET: 'short-production-audit-secret',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'SECURITY_EVENT_HASH_SECRET must be at least 32 characters in production.',
    );
  });

  it('requires a collector bearer token when production metrics are enabled', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_ENABLED: 'true',
      METRICS_BEARER_TOKEN: '',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must be configured when METRICS_ENABLED=true in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'metrics-collector-token-minimum-32-chars',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        metricsBearerToken: 'metrics-collector-token-minimum-32-chars',
        metricsEnabled: true,
      }),
    );
  });
});
