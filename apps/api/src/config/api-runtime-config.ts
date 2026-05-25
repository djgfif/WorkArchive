import { z } from 'zod';

export interface ApiRuntimeConfig {
  authRateLimitMax: number;
  cookieSecure: boolean;
  corsOrigin: string[];
  databaseUrl: string;
  googleOAuthClientId: string | null;
  googleOAuthClientSecret: string | null;
  googleOAuthRedirectUri: string;
  host: string;
  importAuthenticatedRateLimitMax: number;
  importGuestRateLimitMax: number;
  isProduction: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  metricsEnabled: boolean;
  port: number;
  rateLimitPrefix: string;
  rateLimitStore: 'memory' | 'redis';
  rateLimitWindowMs: number;
  redisUrl: string | null;
  securityEventHashSecret: string;
  swaggerEnabled: boolean;
  syncRateLimitMax: number;
  trustProxyHops: number | null;
  webBaseUrl: string;
}

const DEFAULT_PRODUCTION_SECRET_VALUES = new Map([
  [
    'JWT_ACCESS_SECRET',
    ['change-me-access-secret', 'local-compose-access-secret-minimum-32-chars'],
  ],
  [
    'JWT_REFRESH_SECRET',
    [
      'change-me-refresh-secret',
      'local-compose-refresh-secret-minimum-32-chars',
    ],
  ],
  [
    'EXTERNAL_API_KEY_ENCRYPTION_SECRET',
    [
      'change-me-external-api-key-encryption-secret',
      'local-compose-external-api-key-secret-32-chars',
    ],
  ],
  [
    'SECURITY_EVENT_HASH_SECRET',
    [
      'change-me-security-event-hash-secret',
      'local-compose-security-event-secret-32-chars',
    ],
  ],
]);

const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
const DEVELOPMENT_SECURITY_EVENT_HASH_SECRET =
  'development-security-event-hash-secret';
const DEVELOPMENT_WEB_ORIGINS = [
  'http://localhost:18730',
];

const apiEnvironmentSchema = z
  .object({
    AUTH_RATE_LIMIT_MAX: z.string().optional(),
    COOKIE_SECURE: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    EXTERNAL_API_KEY_ENCRYPTION_SECRET: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
    HOST: z.string().optional(),
    IMPORT_AUTH_RATE_LIMIT_MAX: z.string().optional(),
    IMPORT_GUEST_RATE_LIMIT_MAX: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    METRICS_ENABLED: z.string().optional(),
    NODE_ENV: z.string().optional(),
    PORT: z.string().optional(),
    PUBLIC_WEB_BASE_URL: z.string().optional(),
    RATE_LIMIT_PREFIX: z.string().optional(),
    RATE_LIMIT_STORE: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: z.string().optional(),
    REDIS_URL: z.string().optional(),
    SECURITY_EVENT_HASH_SECRET: z.string().optional(),
    SEED_DEMO_PASSWORD: z.string().optional(),
    SWAGGER_ENABLED: z.string().optional(),
    SYNC_RATE_LIMIT_MAX: z.string().optional(),
    TRUST_PROXY_HOPS: z.string().optional(),
    WEB_BASE_URL: z.string().optional(),
  })
  .passthrough();

function readEnvironment() {
  return apiEnvironmentSchema.parse(process.env);
}

function readRequiredEnvString(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured before the API starts.`);
  }

  return value;
}

function isProductionEnvironment() {
  return process.env.NODE_ENV?.trim() === 'production';
}

function rejectDefaultProductionSecret(name: string, value: string) {
  if (!isProductionEnvironment()) {
    return;
  }

  const defaultValues = DEFAULT_PRODUCTION_SECRET_VALUES.get(name) ?? [];
  const normalizedValue = value.trim().toLowerCase();
  const hasDevelopmentPattern =
    normalizedValue.startsWith('change-me') ||
    normalizedValue.startsWith('local-compose') ||
    normalizedValue.includes('demo-password');

  if (defaultValues.includes(value) || hasDevelopmentPattern) {
    throw new Error(
      `${name} must be changed from the development default in production.`,
    );
  }

  if (value.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MINIMUM_PRODUCTION_SECRET_LENGTH} characters in production.`,
    );
  }
}

function readProductionSafeSecret(name: string) {
  const value = readRequiredEnvString(name);

  rejectDefaultProductionSecret(name, value);

  return value;
}

function readSecurityEventHashSecret(isProduction: boolean) {
  const value = process.env.SECURITY_EVENT_HASH_SECRET?.trim();

  if (!value) {
    if (isProduction) {
      throw new Error(
        'SECURITY_EVENT_HASH_SECRET must be configured in production.',
      );
    }

    return DEVELOPMENT_SECURITY_EVENT_HASH_SECRET;
  }

  rejectDefaultProductionSecret('SECURITY_EVENT_HASH_SECRET', value);

  return value;
}

function readPort(value: string | undefined, fallback: number) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('PORT must be a positive integer.');
  }

  return parsedValue;
}

function readPositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(
    'Boolean environment values must be either "true" or "false".',
  );
}

function isLocalhostOrigin(origin: string) {
  try {
    const parsedOrigin = new URL(origin);

    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
      parsedOrigin.hostname,
    );
  } catch {
    return false;
  }
}

function assertProductionHttpsUrl(
  name: string,
  value: string,
  isProduction: boolean,
) {
  if (!isProduction) {
    return;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL in production.`);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${name} must use https:// in production.`);
  }
}

function readCorsOrigin(value: string | undefined, isProduction: boolean) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    if (isProduction) {
      throw new Error('CORS_ORIGIN must be configured in production.');
    }

    return DEVELOPMENT_WEB_ORIGINS;
  }

  if (normalizedValue === '*') {
    throw new Error('CORS_ORIGIN must be an explicit whitelist, not "*".');
  }

  const origins = normalizedValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must include at least one allowed origin.');
  }

  if (isProduction && origins.some((origin) => isLocalhostOrigin(origin))) {
    throw new Error('CORS_ORIGIN must not use localhost in production.');
  }

  for (const origin of origins) {
    assertProductionHttpsUrl('CORS_ORIGIN', origin, isProduction);
  }

  return origins;
}

function readWebBaseUrl(isProduction: boolean) {
  const webBaseUrl = process.env.WEB_BASE_URL?.trim();
  const publicWebBaseUrl = process.env.PUBLIC_WEB_BASE_URL?.trim();
  const configuredValue = webBaseUrl || publicWebBaseUrl;

  if (configuredValue) {
    assertProductionHttpsUrl(
      webBaseUrl ? 'WEB_BASE_URL' : 'PUBLIC_WEB_BASE_URL',
      configuredValue,
      isProduction,
    );

    return configuredValue;
  }

  if (isProduction) {
    throw new Error('WEB_BASE_URL must be configured in production.');
  }

  return 'http://localhost:18730';
}

function readGoogleOAuthRedirectUri(isProduction: boolean, webBaseUrl: string) {
  const configuredValue = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

  if (configuredValue) {
    assertProductionHttpsUrl(
      'GOOGLE_OAUTH_REDIRECT_URI',
      configuredValue,
      isProduction,
    );

    return configuredValue;
  }

  if (isProduction) {
    throw new Error(
      'GOOGLE_OAUTH_REDIRECT_URI must be configured in production.',
    );
  }

  return `${webBaseUrl.replace(/\/$/, '')}/api/auth/google/callback`;
}

function readRateLimitStore(isProduction: boolean) {
  const configuredValue = process.env.RATE_LIMIT_STORE?.trim().toLowerCase();

  if (!configuredValue) {
    return isProduction ? ('redis' as const) : ('memory' as const);
  }

  if (configuredValue !== 'memory' && configuredValue !== 'redis') {
    throw new Error('RATE_LIMIT_STORE must be either "memory" or "redis".');
  }

  if (isProduction && configuredValue === 'memory') {
    throw new Error('RATE_LIMIT_STORE must not be "memory" in production.');
  }

  return configuredValue;
}

function readRedisUrl(rateLimitStore: ApiRuntimeConfig['rateLimitStore']) {
  const normalizedValue = process.env.REDIS_URL?.trim();

  if (rateLimitStore !== 'redis') {
    return null;
  }

  if (!normalizedValue) {
    throw new Error(
      'REDIS_URL must be configured when RATE_LIMIT_STORE is "redis".',
    );
  }

  try {
    const redisUrl = new URL(normalizedValue);

    if (redisUrl.protocol !== 'redis:' && redisUrl.protocol !== 'rediss:') {
      throw new Error();
    }
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }

  return normalizedValue;
}

function readTrustProxyHops(isProduction: boolean) {
  const normalizedValue = process.env.TRUST_PROXY_HOPS?.trim().toLowerCase();

  if (!normalizedValue) {
    if (isProduction) {
      throw new Error('TRUST_PROXY_HOPS must be configured in production.');
    }

    return null;
  }

  if (normalizedValue === 'true' || normalizedValue === 'false') {
    throw new Error(
      'TRUST_PROXY_HOPS must be a positive integer, not a boolean.',
    );
  }

  const trustProxyHops = readPositiveInteger(
    'TRUST_PROXY_HOPS',
    normalizedValue,
    1,
  );

  if (isProduction && trustProxyHops !== 1) {
    throw new Error('TRUST_PROXY_HOPS must be 1 in production.');
  }

  return trustProxyHops;
}

function rejectUnsafeProductionDatabaseUrl(value: string) {
  if (!isProductionEnvironment()) {
    return;
  }

  if (value.includes('postgres:postgres@')) {
    throw new Error(
      'DATABASE_URL must not use the postgres/postgres development credential in production.',
    );
  }
}

function rejectUnsafeProductionSeedDefaults() {
  if (!isProductionEnvironment()) {
    return;
  }

  if (process.env.SEED_DEMO_PASSWORD?.trim() === 'demo-password-123') {
    throw new Error(
      'SEED_DEMO_PASSWORD must not use the demo password in production.',
    );
  }
}

export function readApiRuntimeConfig(): ApiRuntimeConfig {
  readEnvironment();

  const isProduction = isProductionEnvironment();
  const cookieSecure = readBoolean(process.env.COOKIE_SECURE, isProduction);
  const databaseUrl = readRequiredEnvString('DATABASE_URL');
  const port = readPort(process.env.PORT, 18731);
  const swaggerEnabled = readBoolean(
    process.env.SWAGGER_ENABLED,
    !isProduction,
  );
  const corsOrigin = readCorsOrigin(process.env.CORS_ORIGIN, isProduction);
  const webBaseUrl = readWebBaseUrl(isProduction);
  const googleOAuthClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null;
  const googleOAuthClientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null;
  const googleOAuthRedirectUri = readGoogleOAuthRedirectUri(
    isProduction,
    webBaseUrl,
  );
  const jwtAccessSecret = readProductionSafeSecret('JWT_ACCESS_SECRET');
  const jwtRefreshSecret = readProductionSafeSecret('JWT_REFRESH_SECRET');
  const securityEventHashSecret = readSecurityEventHashSecret(isProduction);
  const rateLimitStore = readRateLimitStore(isProduction);
  const redisUrl = readRedisUrl(rateLimitStore);
  const trustProxyHops = readTrustProxyHops(isProduction);

  rejectUnsafeProductionDatabaseUrl(databaseUrl);
  rejectUnsafeProductionSeedDefaults();

  if (isProduction && !cookieSecure) {
    throw new Error('COOKIE_SECURE must not be false in production.');
  }

  if (isProduction && swaggerEnabled) {
    throw new Error('SWAGGER_ENABLED must not be true in production.');
  }

  return {
    authRateLimitMax: readPositiveInteger(
      'AUTH_RATE_LIMIT_MAX',
      process.env.AUTH_RATE_LIMIT_MAX,
      10,
    ),
    cookieSecure,
    corsOrigin,
    databaseUrl,
    googleOAuthClientId,
    googleOAuthClientSecret,
    googleOAuthRedirectUri,
    host: process.env.HOST?.trim() || '0.0.0.0',
    importAuthenticatedRateLimitMax: readPositiveInteger(
      'IMPORT_AUTH_RATE_LIMIT_MAX',
      process.env.IMPORT_AUTH_RATE_LIMIT_MAX,
      60,
    ),
    importGuestRateLimitMax: readPositiveInteger(
      'IMPORT_GUEST_RATE_LIMIT_MAX',
      process.env.IMPORT_GUEST_RATE_LIMIT_MAX,
      20,
    ),
    isProduction,
    jwtAccessSecret,
    jwtRefreshSecret,
    metricsEnabled: readBoolean(process.env.METRICS_ENABLED, false),
    port,
    rateLimitPrefix:
      process.env.RATE_LIMIT_PREFIX?.trim() || 'work-archive:rate-limit:',
    rateLimitStore,
    rateLimitWindowMs: readPositiveInteger(
      'RATE_LIMIT_WINDOW_MS',
      process.env.RATE_LIMIT_WINDOW_MS,
      60_000,
    ),
    redisUrl,
    securityEventHashSecret,
    swaggerEnabled,
    syncRateLimitMax: readPositiveInteger(
      'SYNC_RATE_LIMIT_MAX',
      process.env.SYNC_RATE_LIMIT_MAX,
      30,
    ),
    trustProxyHops,
    webBaseUrl,
  };
}

export function readExternalApiKeyEncryptionSecret() {
  return readProductionSafeSecret('EXTERNAL_API_KEY_ENCRYPTION_SECRET');
}

export function getPublicApiHost(host: string) {
  if (host === '0.0.0.0' || host === '::') {
    return 'localhost';
  }

  return host;
}
