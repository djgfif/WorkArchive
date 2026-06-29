import { afterEach, describe, expect, it } from '@jest/globals';

import {
  readApiLogLevel,
  readApiRuntimeConfig,
  readExternalApiKeyEncryptionSecret,
} from '../src/config/api-runtime-config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv = {}) {
  const productionDefaults =
    overrides.NODE_ENV === 'production'
      ? {
          DATABASE_URL:
            'postgresql://work:archive@postgres:5432/work_archive?schema=public',
          RATE_LIMIT_STORE: 'redis',
          REDIS_URL: 'redis://redis:6379',
          SECURITY_EVENT_HASH_SECRET:
            'production-security-event-hash-secret-minimum-32-chars',
          TRUST_PROXY_HOPS: '1',
          GOOGLE_OAUTH_CLIENT_ID: 'production-google-client-id',
          GOOGLE_OAUTH_CLIENT_SECRET: 'production-google-client-secret',
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

  it('reads an explicit structured log level and rejects unsupported values', () => {
    resetEnv();

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        logLevel: 'info',
      }),
    );
    expect(readApiLogLevel()).toBe('info');

    for (const level of [
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
      'silent',
    ] as const) {
      resetEnv({
        LOG_LEVEL: level.toUpperCase(),
      });

      expect(readApiRuntimeConfig()).toEqual(
        expect.objectContaining({
          logLevel: level,
        }),
      );
      expect(readApiLogLevel()).toBe(level);
    }

    resetEnv({
      LOG_LEVEL: 'verbose',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'LOG_LEVEL must be one of "trace", "debug", "info", "warn", "error", "fatal", or "silent".',
    );
    expect(() => readApiLogLevel()).toThrow(
      'LOG_LEVEL must be one of "trace", "debug", "info", "warn", "error", "fatal", or "silent".',
    );
  });

  it('reads bounded request body limits and rejects unsafe production values', () => {
    resetEnv();

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        jsonBodyLimit: '2mb',
        urlencodedBodyLimit: '64kb',
      }),
    );

    resetEnv({
      API_JSON_BODY_LIMIT: '4mb',
      API_URLENCODED_BODY_LIMIT: '128kb',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        jsonBodyLimit: '4mb',
        urlencodedBodyLimit: '128kb',
      }),
    );

    resetEnv({
      API_JSON_BODY_LIMIT: 'two-mb',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_JSON_BODY_LIMIT must use a positive size ending in b, kb, or mb.',
    );

    resetEnv({
      API_JSON_BODY_LIMIT: '6mb',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_JSON_BODY_LIMIT must not exceed 5242880 bytes in production.',
    );

    resetEnv({
      API_URLENCODED_BODY_LIMIT: '512kb',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_URLENCODED_BODY_LIMIT must not exceed 262144 bytes in production.',
    );
  });

  it('reads bounded readiness check timeouts and rejects unsafe production values', () => {
    resetEnv();

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        readinessCheckTimeoutMs: 1500,
      }),
    );

    resetEnv({
      READINESS_CHECK_TIMEOUT_MS: '2500',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        readinessCheckTimeoutMs: 2500,
      }),
    );

    resetEnv({
      READINESS_CHECK_TIMEOUT_MS: '0',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'READINESS_CHECK_TIMEOUT_MS must be a positive integer.',
    );

    resetEnv({
      READINESS_CHECK_TIMEOUT_MS: '6000',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'READINESS_CHECK_TIMEOUT_MS must not exceed 5000 in production.',
    );
  });

  it('reads bounded HTTP server timeouts and rejects unsafe production values', () => {
    resetEnv();

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        headersTimeoutMs: 15_000,
        keepAliveTimeoutMs: 5_000,
        requestTimeoutMs: 120_000,
      }),
    );

    resetEnv({
      API_HEADERS_TIMEOUT_MS: '20000',
      API_KEEP_ALIVE_TIMEOUT_MS: '10000',
      API_REQUEST_TIMEOUT_MS: '90000',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        headersTimeoutMs: 20_000,
        keepAliveTimeoutMs: 10_000,
        requestTimeoutMs: 90_000,
      }),
    );

    resetEnv({
      API_REQUEST_TIMEOUT_MS: '0',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_REQUEST_TIMEOUT_MS must be a positive integer.',
    );

    resetEnv({
      API_REQUEST_TIMEOUT_MS: '120001',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_REQUEST_TIMEOUT_MS must not exceed 120000 in production.',
    );

    resetEnv({
      API_HEADERS_TIMEOUT_MS: '30001',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_HEADERS_TIMEOUT_MS must not exceed 30000 in production.',
    );

    resetEnv({
      API_KEEP_ALIVE_TIMEOUT_MS: '15001',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_KEEP_ALIVE_TIMEOUT_MS must not exceed 15000 in production.',
    );

    resetEnv({
      API_HEADERS_TIMEOUT_MS: '20000',
      API_REQUEST_TIMEOUT_MS: '10000',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_HEADERS_TIMEOUT_MS must not exceed API_REQUEST_TIMEOUT_MS.',
    );

    resetEnv({
      API_HEADERS_TIMEOUT_MS: '5000',
      API_KEEP_ALIVE_TIMEOUT_MS: '5000',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_HEADERS_TIMEOUT_MS.',
    );
  });

  it('rejects non-plain or unsafe integer runtime settings before startup', () => {
    resetEnv({
      PORT: '1e4',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PORT must be a positive integer.',
    );

    resetEnv({
      PORT: '70000',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PORT must be between 1 and 65535.',
    );

    resetEnv({
      READINESS_CHECK_TIMEOUT_MS: '1500.0',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'READINESS_CHECK_TIMEOUT_MS must be a positive integer.',
    );

    resetEnv({
      RATE_LIMIT_WINDOW_MS: '60000ms',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'RATE_LIMIT_WINDOW_MS must be a positive integer.',
    );

    resetEnv({
      API_REQUEST_TIMEOUT_MS: '9007199254740992',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_REQUEST_TIMEOUT_MS must be a safe integer.',
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
      WORK_ARCHIVE_CLIENT_HEADER_GUARD: 'off',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        clientHeaderGuardMode: 'off',
      }),
    );

    resetEnv({
      CORS_ORIGIN: 'https://workarchive.example.com',
      NODE_ENV: 'production',
      WEB_BASE_URL: 'https://workarchive.example.com',
      WORK_ARCHIVE_CLIENT_HEADER_GUARD: 'off',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be audit or enforce in production.',
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

  it('blocks reused production runtime secrets', () => {
    const reusedSecret = 'reused-production-secret-minimum-32-chars';

    resetEnv({
      JWT_ACCESS_SECRET: reusedSecret,
      JWT_REFRESH_SECRET: reusedSecret,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'JWT_REFRESH_SECRET must not reuse the same production secret value as JWT_ACCESS_SECRET.',
    );

    resetEnv({
      METRICS_BEARER_TOKEN: reusedSecret,
      METRICS_ENABLED: 'true',
      METRICS_INTERNAL_ACCESS_REVIEWED: 'true',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      SECURITY_EVENT_HASH_SECRET: reusedSecret,
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must not reuse the same production secret value as SECURITY_EVENT_HASH_SECRET.',
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

  it('blocks reused external API key encryption secrets in production', () => {
    const reusedSecret = 'reused-production-secret-minimum-32-chars';

    resetEnv({
      EXTERNAL_API_KEY_ENCRYPTION_SECRET: reusedSecret,
      JWT_ACCESS_SECRET: reusedSecret,
      NODE_ENV: 'production',
    });

    expect(() => readExternalApiKeyEncryptionSecret()).toThrow(
      'EXTERNAL_API_KEY_ENCRYPTION_SECRET must not reuse the same production secret value as JWT_ACCESS_SECRET.',
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
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_REDIRECT_URI:
        'https://workarchive.example.com/oauth/google/callback?next=/',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_REDIRECT_URI must use /api/auth/google/callback with no query string or fragment in production.',
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

  it('rejects production placeholder public URLs before startup', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://archive.example.com',
      WEB_BASE_URL: 'https://archive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'CORS_ORIGIN must be set to a host-specific production value.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://archive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WEB_BASE_URL must be set to a host-specific production value.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_REDIRECT_URI:
        'https://archive.example.com/api/auth/google/callback',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_REDIRECT_URI must be set to a host-specific production value.',
    );
  });

  it('requires the production web base origin to be allowed by CORS', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://admin.workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'WEB_BASE_URL origin must be included in CORS_ORIGIN in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN:
        'https://admin.workarchive.example.com,https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com/some/path',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        corsOrigin: [
          'https://admin.workarchive.example.com',
          'https://workarchive.example.com',
        ],
        webBaseUrl: 'https://workarchive.example.com/some/path',
      }),
    );
  });

  it('requires Google OAuth credentials in production and keeps partial OAuth config invalid everywhere', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_CLIENT_ID: '',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured in production.',
    );

    resetEnv({
      GOOGLE_OAUTH_CLIENT_ID: 'local-google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
      NODE_ENV: 'development',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured together.',
    );

    resetEnv({
      GOOGLE_OAUTH_CLIENT_ID: '',
      GOOGLE_OAUTH_CLIENT_SECRET: 'local-google-client-secret',
      NODE_ENV: 'development',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured together.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_CLIENT_ID: '<google-oauth-web-client-id>',
      GOOGLE_OAUTH_CLIENT_SECRET: 'production-google-client-secret',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_CLIENT_ID must be set to a host-specific production value.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      GOOGLE_OAUTH_CLIENT_ID: 'production-google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: '<google-oauth-web-client-secret>',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'GOOGLE_OAUTH_CLIENT_SECRET must be set to a host-specific production value.',
    );
  });

  it('blocks development database and seed defaults in production', () => {
    resetEnv({
      DATABASE_URL: 'mysql://work:archive@postgres:3306/work_archive',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'DATABASE_URL must use the postgresql:// or postgres:// scheme in production.',
    );

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
      DATABASE_URL:
        'postgresql://work:archive@localhost:5432/work_archive?schema=public',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'DATABASE_URL must not use localhost in production.',
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
      REDIS_URL: 'redis://127.0.0.1:6379',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'REDIS_URL must not use localhost in production.',
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
        globalRateLimitMax: 600,
        authSensitiveRateLimitMax: 5,
        catalogRateLimitMax: 20,
        mutationRateLimitMax: 120,
        rateLimitPrefix: 'work-archive:rate-limit:',
        rateLimitStore: 'redis',
        redisUrl: 'redis://redis:6379',
        securityEventHashSecret:
          'production-security-event-hash-secret-minimum-32-chars',
        trustProxyHops: 1,
      }),
    );
  });

  it('reads a bounded global API rate limit and rejects unsafe production values', () => {
    resetEnv({
      API_GLOBAL_RATE_LIMIT_MAX: '1200',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        globalRateLimitMax: 1200,
      }),
    );

    resetEnv({
      API_GLOBAL_RATE_LIMIT_MAX: '0',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_GLOBAL_RATE_LIMIT_MAX must be a positive integer.',
    );

    resetEnv({
      API_GLOBAL_RATE_LIMIT_MAX: '2001',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'API_GLOBAL_RATE_LIMIT_MAX must not exceed 2000 in production.',
    );
  });

  it('reads a bounded sensitive auth operation rate limit and rejects unsafe production values', () => {
    resetEnv({
      AUTH_SENSITIVE_RATE_LIMIT_MAX: '20',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        authSensitiveRateLimitMax: 20,
      }),
    );

    resetEnv({
      AUTH_SENSITIVE_RATE_LIMIT_MAX: '0',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'AUTH_SENSITIVE_RATE_LIMIT_MAX must be a positive integer.',
    );

    resetEnv({
      AUTH_SENSITIVE_RATE_LIMIT_MAX: '61',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'AUTH_SENSITIVE_RATE_LIMIT_MAX must not exceed 60 in production.',
    );
  });

  it('reads bounded route-specific API rate limits and rejects unsafe production values', () => {
    resetEnv({
      AUTH_RATE_LIMIT_MAX: '300',
      CATALOG_RATE_LIMIT_MAX: '60',
      IMPORT_AUTH_RATE_LIMIT_MAX: '300',
      IMPORT_GUEST_RATE_LIMIT_MAX: '60',
      IMAGE_PROXY_RATE_LIMIT_MAX: '600',
      MUTATION_RATE_LIMIT_MAX: '300',
      NOTION_RATE_LIMIT_MAX: '60',
      RATE_LIMIT_WINDOW_MS: '300000',
      SYNC_RATE_LIMIT_MAX: '300',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        authRateLimitMax: 300,
        catalogRateLimitMax: 60,
        importAuthenticatedRateLimitMax: 300,
        importGuestRateLimitMax: 60,
        imageProxyRateLimitMax: 600,
        mutationRateLimitMax: 300,
        notionRateLimitMax: 60,
        rateLimitWindowMs: 300000,
        syncRateLimitMax: 300,
      }),
    );

    for (const [name, value, message] of [
      [
        'AUTH_RATE_LIMIT_MAX',
        '301',
        'AUTH_RATE_LIMIT_MAX must not exceed 300 in production.',
      ],
      [
        'CATALOG_RATE_LIMIT_MAX',
        '61',
        'CATALOG_RATE_LIMIT_MAX must not exceed 60 in production.',
      ],
      [
        'IMPORT_AUTH_RATE_LIMIT_MAX',
        '301',
        'IMPORT_AUTH_RATE_LIMIT_MAX must not exceed 300 in production.',
      ],
      [
        'IMPORT_GUEST_RATE_LIMIT_MAX',
        '61',
        'IMPORT_GUEST_RATE_LIMIT_MAX must not exceed 60 in production.',
      ],
      [
        'IMAGE_PROXY_RATE_LIMIT_MAX',
        '601',
        'IMAGE_PROXY_RATE_LIMIT_MAX must not exceed 600 in production.',
      ],
      [
        'MUTATION_RATE_LIMIT_MAX',
        '301',
        'MUTATION_RATE_LIMIT_MAX must not exceed 300 in production.',
      ],
      [
        'NOTION_RATE_LIMIT_MAX',
        '61',
        'NOTION_RATE_LIMIT_MAX must not exceed 60 in production.',
      ],
      [
        'RATE_LIMIT_WINDOW_MS',
        '300001',
        'RATE_LIMIT_WINDOW_MS must not exceed 300000 in production.',
      ],
      [
        'SYNC_RATE_LIMIT_MAX',
        '301',
        'SYNC_RATE_LIMIT_MAX must not exceed 300 in production.',
      ],
    ] as const) {
      resetEnv({
        [name]: value,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://workarchive.example.com',
        WEB_BASE_URL: 'https://workarchive.example.com',
      });

      expect(() => readApiRuntimeConfig()).toThrow(message);
    }
  });

  it('rejects malformed host and Redis rate-limit prefix values before startup', () => {
    resetEnv({
      HOST: 'https://api.workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'HOST must be a host or IP address, not a URL.',
    );

    resetEnv({
      RATE_LIMIT_PREFIX: 'work archive:',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'RATE_LIMIT_PREFIX must not contain whitespace.',
    );
  });

  it('rejects malformed import provider operational flags before startup', () => {
    for (const [name, value, message] of [
      [
        'IMPORT_SERVER_SEARCH_GUEST_ENABLED',
        'yes',
        'IMPORT_SERVER_SEARCH_GUEST_ENABLED must be true or false when set.',
      ],
      [
        'IMPORT_SERVER_SEARCH_GUEST_APPROVED',
        '1',
        'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true or false when set.',
      ],
      [
        'KOBIS_HTTP_PROVIDER_ENABLED',
        'on',
        'KOBIS_HTTP_PROVIDER_ENABLED must be true or false when set.',
      ],
    ] as const) {
      resetEnv({
        [name]: value,
      });

      expect(() => readApiRuntimeConfig()).toThrow(message);
    }
  });

  it('rejects development-only flags before production startup', () => {
    resetEnv({
      PASSWORD_RESET_DEV_LINKS_ENABLED: 'treu',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PASSWORD_RESET_DEV_LINKS_ENABLED must be true or false when set.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      PASSWORD_RESET_DEV_LINKS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'PASSWORD_RESET_DEV_LINKS_ENABLED must not be true in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      PASSWORD_RESET_DEV_LINKS_ENABLED: 'false',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        isProduction: true,
      }),
    );
  });

  it('requires explicit production approval before startup when guest server search is enabled', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      IMPORT_SERVER_SEARCH_GUEST_APPROVED: 'false',
      IMPORT_SERVER_SEARCH_GUEST_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      IMPORT_SERVER_SEARCH_GUEST_APPROVED: 'true',
      IMPORT_SERVER_SEARCH_GUEST_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        isProduction: true,
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
      METRICS_BEARER_TOKEN: 'short-metrics-token',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must be at least 32 characters in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'change-me-metrics-bearer-token',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must be changed from the development default in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'metrics collector token minimum 32 chars',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must not contain whitespace.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN:
        'local-compose-metrics-bearer-token-minimum-32-chars',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must be changed from the development default in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'demo-password-metrics-token-minimum-32-chars',
      METRICS_ENABLED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_BEARER_TOKEN must be changed from the development default in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'metrics-collector-token-minimum-32-chars',
      METRICS_ENABLED: 'true',
      METRICS_INTERNAL_ACCESS_REVIEWED: 'false',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'METRICS_INTERNAL_ACCESS_REVIEWED must be true when METRICS_ENABLED=true in production.',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: 'metrics-collector-token-minimum-32-chars',
      METRICS_ENABLED: 'true',
      METRICS_INTERNAL_ACCESS_REVIEWED: 'true',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        metricsBearerToken: 'metrics-collector-token-minimum-32-chars',
        metricsEnabled: true,
      }),
    );
  });

  it('allows production metrics to stay disabled without a collector bearer token', () => {
    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_ENABLED: 'false',
      METRICS_INTERNAL_ACCESS_REVIEWED: 'yes',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(() => readApiRuntimeConfig()).toThrow(
      'Boolean environment values must be either "true" or "false".',
    );

    resetEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://workarchive.example.com',
      METRICS_BEARER_TOKEN: '',
      METRICS_ENABLED: 'false',
      WEB_BASE_URL: 'https://workarchive.example.com',
    });

    expect(readApiRuntimeConfig()).toEqual(
      expect.objectContaining({
        metricsBearerToken: null,
        metricsEnabled: false,
      }),
    );
  });
});
