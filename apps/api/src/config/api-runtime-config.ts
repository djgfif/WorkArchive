import { z } from 'zod';

export interface ApiRuntimeConfig {
  authRateLimitMax: number;
  authSensitiveRateLimitMax: number;
  catalogRateLimitMax: number;
  globalRateLimitMax: number;
  clientHeaderGuardMode: 'audit' | 'enforce' | 'off';
  cookieSecure: boolean;
  corsOrigin: string[];
  databaseUrl: string;
  googleOAuthClientId: string | null;
  googleOAuthClientSecret: string | null;
  googleOAuthRedirectUri: string;
  headersTimeoutMs: number;
  host: string;
  importAuthenticatedRateLimitMax: number;
  importGuestRateLimitMax: number;
  imageProxyRateLimitMax: number;
  isProduction: boolean;
  jsonBodyLimit: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  keepAliveTimeoutMs: number;
  logLevel: ApiLogLevel;
  metricsBearerToken: string | null;
  metricsEnabled: boolean;
  mutationRateLimitMax: number;
  notionRateLimitMax: number;
  port: number;
  rateLimitPrefix: string;
  rateLimitStore: 'memory' | 'redis';
  rateLimitWindowMs: number;
  readinessCheckTimeoutMs: number;
  redisUrl: string | null;
  requestTimeoutMs: number;
  securityEventHashSecret: string;
  swaggerEnabled: boolean;
  syncRateLimitMax: number;
  trustProxyHops: number | null;
  urlencodedBodyLimit: string;
  webBaseUrl: string;
}

export type ApiLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent';

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
  [
    'METRICS_BEARER_TOKEN',
    [
      'change-me-metrics-bearer-token',
      'local-compose-metrics-bearer-token-minimum-32-chars',
    ],
  ],
]);

const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
const MAXIMUM_PRODUCTION_JSON_BODY_BYTES = 5 * 1024 * 1024;
const MAXIMUM_PRODUCTION_URLENCODED_BODY_BYTES = 256 * 1024;
const DEFAULT_READINESS_CHECK_TIMEOUT_MS = 1500;
const MAXIMUM_PORT = 65_535;
const MAXIMUM_PRODUCTION_READINESS_CHECK_TIMEOUT_MS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 15_000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const MAXIMUM_PRODUCTION_REQUEST_TIMEOUT_MS = 120_000;
const MAXIMUM_PRODUCTION_HEADERS_TIMEOUT_MS = 30_000;
const MAXIMUM_PRODUCTION_KEEP_ALIVE_TIMEOUT_MS = 15_000;
const MAXIMUM_PRODUCTION_GLOBAL_RATE_LIMIT_MAX = 2_000;
const MAXIMUM_PRODUCTION_AUTH_RATE_LIMIT_MAX = 300;
const MAXIMUM_PRODUCTION_AUTH_SENSITIVE_RATE_LIMIT_MAX = 60;
const MAXIMUM_PRODUCTION_CATALOG_RATE_LIMIT_MAX = 60;
const MAXIMUM_PRODUCTION_IMPORT_AUTHENTICATED_RATE_LIMIT_MAX = 300;
const MAXIMUM_PRODUCTION_IMPORT_GUEST_RATE_LIMIT_MAX = 60;
const MAXIMUM_PRODUCTION_IMAGE_PROXY_RATE_LIMIT_MAX = 600;
const MAXIMUM_PRODUCTION_MUTATION_RATE_LIMIT_MAX = 300;
const MAXIMUM_PRODUCTION_NOTION_RATE_LIMIT_MAX = 60;
const MAXIMUM_PRODUCTION_RATE_LIMIT_WINDOW_MS = 300_000;
const MAXIMUM_PRODUCTION_SYNC_RATE_LIMIT_MAX = 300;
const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';
const PRODUCTION_PLACEHOLDER_VALUE_PATTERNS = [
  /^<.*>$/,
  /^https?:\/\/archive\.example\.com(?::\d+)?(?:\/|$)/i,
  /^archive\.example\.com$/i,
  /^change-me/i,
  /^local-compose/i,
] as const;
const DEVELOPMENT_SECURITY_EVENT_HASH_SECRET =
  'development-security-event-hash-secret';
const DEVELOPMENT_WEB_ORIGINS = ['http://localhost:18730'];

const apiEnvironmentSchema = z
  .object({
    API_GLOBAL_RATE_LIMIT_MAX: z.string().optional(),
    AUTH_RATE_LIMIT_MAX: z.string().optional(),
    AUTH_SENSITIVE_RATE_LIMIT_MAX: z.string().optional(),
    CATALOG_RATE_LIMIT_MAX: z.string().optional(),
    API_JSON_BODY_LIMIT: z.string().optional(),
    API_HEADERS_TIMEOUT_MS: z.string().optional(),
    API_KEEP_ALIVE_TIMEOUT_MS: z.string().optional(),
    API_REQUEST_TIMEOUT_MS: z.string().optional(),
    API_URLENCODED_BODY_LIMIT: z.string().optional(),
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
    IMPORT_SERVER_SEARCH_GUEST_APPROVED: z.string().optional(),
    IMPORT_SERVER_SEARCH_GUEST_ENABLED: z.string().optional(),
    IMAGE_PROXY_RATE_LIMIT_MAX: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    KOBIS_HTTP_PROVIDER_ENABLED: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
    METRICS_BEARER_TOKEN: z.string().optional(),
    METRICS_ENABLED: z.string().optional(),
    METRICS_INTERNAL_ACCESS_REVIEWED: z.string().optional(),
    MUTATION_RATE_LIMIT_MAX: z.string().optional(),
    NODE_ENV: z.string().optional(),
    NOTION_RATE_LIMIT_MAX: z.string().optional(),
    PASSWORD_RESET_DEV_LINKS_ENABLED: z.string().optional(),
    PORT: z.string().optional(),
    PUBLIC_WEB_BASE_URL: z.string().optional(),
    RATE_LIMIT_PREFIX: z.string().optional(),
    RATE_LIMIT_STORE: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: z.string().optional(),
    READINESS_CHECK_TIMEOUT_MS: z.string().optional(),
    REDIS_URL: z.string().optional(),
    SECURITY_EVENT_HASH_SECRET: z.string().optional(),
    SEED_DEMO_PASSWORD: z.string().optional(),
    SWAGGER_ENABLED: z.string().optional(),
    SYNC_RATE_LIMIT_MAX: z.string().optional(),
    TRUST_PROXY_HOPS: z.string().optional(),
    WEB_BASE_URL: z.string().optional(),
    WORK_ARCHIVE_CLIENT_HEADER_GUARD: z.string().optional(),
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

function rejectDuplicateProductionSecrets(
  values: Array<{ name: string; value: string | null }>,
  isProduction: boolean,
) {
  if (!isProduction) {
    return;
  }

  const seen = new Map<string, string>();

  for (const { name, value } of values) {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      continue;
    }

    const previousName = seen.get(normalizedValue);

    if (previousName) {
      throw new Error(
        `${name} must not reuse the same production secret value as ${previousName}.`,
      );
    }

    seen.set(normalizedValue, name);
  }
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

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw new Error('PORT must be a positive integer.');
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error('PORT must be a safe integer.');
  }

  if (parsedValue > MAXIMUM_PORT) {
    throw new Error('PORT must be between 1 and 65535.');
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

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`${name} must be a safe integer.`);
  }

  return parsedValue;
}

function readReadinessCheckTimeoutMs(isProduction: boolean) {
  const timeoutMs = readPositiveInteger(
    'READINESS_CHECK_TIMEOUT_MS',
    process.env.READINESS_CHECK_TIMEOUT_MS,
    DEFAULT_READINESS_CHECK_TIMEOUT_MS,
  );

  if (
    isProduction &&
    timeoutMs > MAXIMUM_PRODUCTION_READINESS_CHECK_TIMEOUT_MS
  ) {
    throw new Error(
      `READINESS_CHECK_TIMEOUT_MS must not exceed ${MAXIMUM_PRODUCTION_READINESS_CHECK_TIMEOUT_MS} in production.`,
    );
  }

  return timeoutMs;
}

function readServerTimeouts(isProduction: boolean) {
  const requestTimeoutMs = readPositiveInteger(
    'API_REQUEST_TIMEOUT_MS',
    process.env.API_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
  const headersTimeoutMs = readPositiveInteger(
    'API_HEADERS_TIMEOUT_MS',
    process.env.API_HEADERS_TIMEOUT_MS,
    DEFAULT_HEADERS_TIMEOUT_MS,
  );
  const keepAliveTimeoutMs = readPositiveInteger(
    'API_KEEP_ALIVE_TIMEOUT_MS',
    process.env.API_KEEP_ALIVE_TIMEOUT_MS,
    DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  );

  if (
    isProduction &&
    requestTimeoutMs > MAXIMUM_PRODUCTION_REQUEST_TIMEOUT_MS
  ) {
    throw new Error(
      `API_REQUEST_TIMEOUT_MS must not exceed ${MAXIMUM_PRODUCTION_REQUEST_TIMEOUT_MS} in production.`,
    );
  }

  if (
    isProduction &&
    headersTimeoutMs > MAXIMUM_PRODUCTION_HEADERS_TIMEOUT_MS
  ) {
    throw new Error(
      `API_HEADERS_TIMEOUT_MS must not exceed ${MAXIMUM_PRODUCTION_HEADERS_TIMEOUT_MS} in production.`,
    );
  }

  if (
    isProduction &&
    keepAliveTimeoutMs > MAXIMUM_PRODUCTION_KEEP_ALIVE_TIMEOUT_MS
  ) {
    throw new Error(
      `API_KEEP_ALIVE_TIMEOUT_MS must not exceed ${MAXIMUM_PRODUCTION_KEEP_ALIVE_TIMEOUT_MS} in production.`,
    );
  }

  if (headersTimeoutMs > requestTimeoutMs) {
    throw new Error(
      'API_HEADERS_TIMEOUT_MS must not exceed API_REQUEST_TIMEOUT_MS.',
    );
  }

  if (keepAliveTimeoutMs >= headersTimeoutMs) {
    throw new Error(
      'API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_HEADERS_TIMEOUT_MS.',
    );
  }

  return {
    headersTimeoutMs,
    keepAliveTimeoutMs,
    requestTimeoutMs,
  };
}

function readBodySizeLimit(
  name: string,
  value: string | undefined,
  fallback: string,
  maxProductionBytes: number,
  isProduction: boolean,
) {
  const normalizedValue = (value?.trim() || fallback).toLowerCase();
  const match = /^([1-9]\d*)(b|kb|mb)$/.exec(normalizedValue);

  if (!match) {
    throw new Error(`${name} must use a positive size ending in b, kb, or mb.`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const bytes =
    unit === 'mb'
      ? amount * 1024 * 1024
      : unit === 'kb'
        ? amount * 1024
        : amount;

  if (isProduction && bytes > maxProductionBytes) {
    throw new Error(
      `${name} must not exceed ${maxProductionBytes} bytes in production.`,
    );
  }

  return normalizedValue;
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

export function readApiLogLevel(value = process.env.LOG_LEVEL): ApiLogLevel {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return 'info';
  }

  if (
    normalizedValue === 'trace' ||
    normalizedValue === 'debug' ||
    normalizedValue === 'info' ||
    normalizedValue === 'warn' ||
    normalizedValue === 'error' ||
    normalizedValue === 'fatal' ||
    normalizedValue === 'silent'
  ) {
    return normalizedValue;
  }

  throw new Error(
    'LOG_LEVEL must be one of "trace", "debug", "info", "warn", "error", "fatal", or "silent".',
  );
}

function readNamedBoolean(name: string, fallback: boolean) {
  const normalizedValue = process.env[name]?.trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(`${name} must be true or false when set.`);
}

function validateImportProviderOperationalFlags(isProduction: boolean) {
  const guestServerSearchEnabled = readNamedBoolean(
    'IMPORT_SERVER_SEARCH_GUEST_ENABLED',
    false,
  );
  const guestServerSearchApproved = readNamedBoolean(
    'IMPORT_SERVER_SEARCH_GUEST_APPROVED',
    false,
  );

  readNamedBoolean('KOBIS_HTTP_PROVIDER_ENABLED', false);

  if (
    isProduction &&
    guestServerSearchEnabled &&
    !guestServerSearchApproved
  ) {
    throw new Error(
      'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
    );
  }
}

function validateDevelopmentOnlyFlags(isProduction: boolean) {
  const passwordResetDevLinksEnabled = readNamedBoolean(
    'PASSWORD_RESET_DEV_LINKS_ENABLED',
    false,
  );

  if (isProduction && passwordResetDevLinksEnabled) {
    throw new Error(
      'PASSWORD_RESET_DEV_LINKS_ENABLED must not be true in production.',
    );
  }
}

function readClientHeaderGuardMode(isProduction: boolean) {
  const normalizedValue =
    process.env.WORK_ARCHIVE_CLIENT_HEADER_GUARD?.trim().toLowerCase();

  if (!normalizedValue) {
    return isProduction ? ('audit' as const) : ('off' as const);
  }

  if (
    normalizedValue === 'off' ||
    normalizedValue === 'audit' ||
    normalizedValue === 'enforce'
  ) {
    if (isProduction && normalizedValue === 'off') {
      throw new Error(
        'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be audit or enforce in production.',
      );
    }

    return normalizedValue;
  }

  throw new Error(
    'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be one of "off", "audit", or "enforce".',
  );
}

function isLocalhostOrigin(origin: string) {
  try {
    const parsedOrigin = new URL(origin);

    return isLocalhostHostname(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

function isLocalhostHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
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

function assertProductionHostSpecificValue(
  name: string,
  value: string,
  isProduction: boolean,
) {
  if (!isProduction) {
    return;
  }

  const normalizedValue = value.trim();

  if (
    PRODUCTION_PLACEHOLDER_VALUE_PATTERNS.some((pattern) =>
      pattern.test(normalizedValue),
    )
  ) {
    throw new Error(`${name} must be set to a host-specific production value.`);
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
    assertProductionHostSpecificValue('CORS_ORIGIN', origin, isProduction);
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
    assertProductionHostSpecificValue(
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

function assertProductionWebBaseUrlInCorsOrigin(
  corsOrigin: string[],
  webBaseUrl: string,
  isProduction: boolean,
) {
  if (!isProduction) {
    return;
  }

  const webBaseOrigin = new URL(webBaseUrl).origin;
  const allowedOrigins = new Set(
    corsOrigin.map((origin) => new URL(origin).origin),
  );

  if (!allowedOrigins.has(webBaseOrigin)) {
    throw new Error(
      'WEB_BASE_URL origin must be included in CORS_ORIGIN in production.',
    );
  }
}

function readGoogleOAuthRedirectUri(isProduction: boolean, webBaseUrl: string) {
  const configuredValue = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

  if (configuredValue) {
    assertProductionHttpsUrl(
      'GOOGLE_OAUTH_REDIRECT_URI',
      configuredValue,
      isProduction,
    );
    assertProductionHostSpecificValue(
      'GOOGLE_OAUTH_REDIRECT_URI',
      configuredValue,
      isProduction,
    );
    assertProductionGoogleOAuthRedirectUriPath(configuredValue, isProduction);

    return configuredValue;
  }

  if (isProduction) {
    throw new Error(
      'GOOGLE_OAUTH_REDIRECT_URI must be configured in production.',
    );
  }

  return `${webBaseUrl.replace(/\/$/, '')}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

function assertProductionGoogleOAuthRedirectUriPath(
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
    return;
  }

  if (
    parsedUrl.pathname !== GOOGLE_OAUTH_CALLBACK_PATH ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== ''
  ) {
    throw new Error(
      `GOOGLE_OAUTH_REDIRECT_URI must use ${GOOGLE_OAUTH_CALLBACK_PATH} with no query string or fragment in production.`,
    );
  }
}

function readGoogleOAuthCredentials(isProduction: boolean) {
  const googleOAuthClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null;
  const googleOAuthClientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null;

  if (isProduction && (!googleOAuthClientId || !googleOAuthClientSecret)) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured in production.',
    );
  }

  if (
    (googleOAuthClientId && !googleOAuthClientSecret) ||
    (!googleOAuthClientId && googleOAuthClientSecret)
  ) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured together.',
    );
  }

  if (googleOAuthClientId) {
    assertProductionHostSpecificValue(
      'GOOGLE_OAUTH_CLIENT_ID',
      googleOAuthClientId,
      isProduction,
    );
  }

  if (googleOAuthClientSecret) {
    assertProductionHostSpecificValue(
      'GOOGLE_OAUTH_CLIENT_SECRET',
      googleOAuthClientSecret,
      isProduction,
    );
  }

  return {
    googleOAuthClientId,
    googleOAuthClientSecret,
  };
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

function readRedisUrl(
  rateLimitStore: ApiRuntimeConfig['rateLimitStore'],
  isProduction: boolean,
) {
  const normalizedValue = process.env.REDIS_URL?.trim();

  if (rateLimitStore !== 'redis') {
    return null;
  }

  if (!normalizedValue) {
    throw new Error(
      'REDIS_URL must be configured when RATE_LIMIT_STORE is "redis".',
    );
  }

  let redisUrl: URL;

  try {
    redisUrl = new URL(normalizedValue);
  } catch (error) {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.', {
      cause: error,
    });
  }

  if (redisUrl.protocol !== 'redis:' && redisUrl.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }

  if (isProduction && isLocalhostHostname(redisUrl.hostname)) {
    throw new Error('REDIS_URL must not use localhost in production.');
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

function readHost() {
  const host = process.env.HOST?.trim() || '0.0.0.0';

  if (/[\s/?#@]/.test(host)) {
    throw new Error('HOST must be a host or IP address, not a URL.');
  }

  return host;
}

function readRateLimitPrefix() {
  const prefix =
    process.env.RATE_LIMIT_PREFIX?.trim() || 'work-archive:rate-limit:';

  if (/\s/.test(prefix)) {
    throw new Error('RATE_LIMIT_PREFIX must not contain whitespace.');
  }

  return prefix;
}

function readGlobalRateLimitMax(isProduction: boolean) {
  const value = readPositiveInteger(
    'API_GLOBAL_RATE_LIMIT_MAX',
    process.env.API_GLOBAL_RATE_LIMIT_MAX,
    600,
  );

  if (isProduction && value > MAXIMUM_PRODUCTION_GLOBAL_RATE_LIMIT_MAX) {
    throw new Error(
      `API_GLOBAL_RATE_LIMIT_MAX must not exceed ${MAXIMUM_PRODUCTION_GLOBAL_RATE_LIMIT_MAX} in production.`,
    );
  }

  return value;
}

function readAuthSensitiveRateLimitMax(isProduction: boolean) {
  const value = readPositiveInteger(
    'AUTH_SENSITIVE_RATE_LIMIT_MAX',
    process.env.AUTH_SENSITIVE_RATE_LIMIT_MAX,
    5,
  );

  if (
    isProduction &&
    value > MAXIMUM_PRODUCTION_AUTH_SENSITIVE_RATE_LIMIT_MAX
  ) {
    throw new Error(
      `AUTH_SENSITIVE_RATE_LIMIT_MAX must not exceed ${MAXIMUM_PRODUCTION_AUTH_SENSITIVE_RATE_LIMIT_MAX} in production.`,
    );
  }

  return value;
}

function readProductionBoundedRateLimitMax(
  name: string,
  fallback: number,
  max: number,
  isProduction: boolean,
) {
  const value = readPositiveInteger(name, process.env[name], fallback);

  if (isProduction && value > max) {
    throw new Error(`${name} must not exceed ${max} in production.`);
  }

  return value;
}

function readMetricsBearerToken() {
  const token = process.env.METRICS_BEARER_TOKEN?.trim() || null;

  if (token && /\s/.test(token)) {
    throw new Error('METRICS_BEARER_TOKEN must not contain whitespace.');
  }

  return token;
}

function rejectUnsafeProductionDatabaseUrl(value: string) {
  if (!isProductionEnvironment()) {
    return;
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL URL in production.',
    );
  }

  if (
    databaseUrl.protocol !== 'postgresql:' &&
    databaseUrl.protocol !== 'postgres:'
  ) {
    throw new Error(
      'DATABASE_URL must use the postgresql:// or postgres:// scheme in production.',
    );
  }

  if (
    decodeURIComponent(databaseUrl.username) === 'postgres' &&
    decodeURIComponent(databaseUrl.password) === 'postgres'
  ) {
    throw new Error(
      'DATABASE_URL must not use the postgres/postgres development credential in production.',
    );
  }

  if (isLocalhostHostname(databaseUrl.hostname)) {
    throw new Error('DATABASE_URL must not use localhost in production.');
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
  assertProductionWebBaseUrlInCorsOrigin(corsOrigin, webBaseUrl, isProduction);
  const { googleOAuthClientId, googleOAuthClientSecret } =
    readGoogleOAuthCredentials(isProduction);
  const googleOAuthRedirectUri = readGoogleOAuthRedirectUri(
    isProduction,
    webBaseUrl,
  );
  const jwtAccessSecret = readProductionSafeSecret('JWT_ACCESS_SECRET');
  const jwtRefreshSecret = readProductionSafeSecret('JWT_REFRESH_SECRET');
  const securityEventHashSecret = readSecurityEventHashSecret(isProduction);
  const jsonBodyLimit = readBodySizeLimit(
    'API_JSON_BODY_LIMIT',
    process.env.API_JSON_BODY_LIMIT,
    '2mb',
    MAXIMUM_PRODUCTION_JSON_BODY_BYTES,
    isProduction,
  );
  const urlencodedBodyLimit = readBodySizeLimit(
    'API_URLENCODED_BODY_LIMIT',
    process.env.API_URLENCODED_BODY_LIMIT,
    '64kb',
    MAXIMUM_PRODUCTION_URLENCODED_BODY_BYTES,
    isProduction,
  );
  const rateLimitStore = readRateLimitStore(isProduction);
  const redisUrl = readRedisUrl(rateLimitStore, isProduction);
  const trustProxyHops = readTrustProxyHops(isProduction);
  const readinessCheckTimeoutMs = readReadinessCheckTimeoutMs(isProduction);
  const serverTimeouts = readServerTimeouts(isProduction);
  const logLevel = readApiLogLevel();

  validateImportProviderOperationalFlags(isProduction);
  validateDevelopmentOnlyFlags(isProduction);
  rejectUnsafeProductionDatabaseUrl(databaseUrl);
  rejectUnsafeProductionSeedDefaults();

  if (isProduction && !cookieSecure) {
    throw new Error('COOKIE_SECURE must not be false in production.');
  }

  if (isProduction && swaggerEnabled) {
    throw new Error('SWAGGER_ENABLED must not be true in production.');
  }

  const metricsEnabled = readBoolean(process.env.METRICS_ENABLED, false);
  const metricsInternalAccessReviewed = readBoolean(
    process.env.METRICS_INTERNAL_ACCESS_REVIEWED,
    false,
  );
  const metricsBearerToken = readMetricsBearerToken();

  if (isProduction && metricsEnabled && !metricsBearerToken) {
    throw new Error(
      'METRICS_BEARER_TOKEN must be configured when METRICS_ENABLED=true in production.',
    );
  }

  if (isProduction && metricsEnabled && metricsBearerToken) {
    rejectDefaultProductionSecret('METRICS_BEARER_TOKEN', metricsBearerToken);
  }

  if (isProduction && metricsEnabled && !metricsInternalAccessReviewed) {
    throw new Error(
      'METRICS_INTERNAL_ACCESS_REVIEWED must be true when METRICS_ENABLED=true in production.',
    );
  }

  rejectDuplicateProductionSecrets(
    [
      { name: 'JWT_ACCESS_SECRET', value: jwtAccessSecret },
      { name: 'JWT_REFRESH_SECRET', value: jwtRefreshSecret },
      { name: 'SECURITY_EVENT_HASH_SECRET', value: securityEventHashSecret },
      { name: 'METRICS_BEARER_TOKEN', value: metricsBearerToken },
    ],
    isProduction,
  );

  return {
    authRateLimitMax: readProductionBoundedRateLimitMax(
      'AUTH_RATE_LIMIT_MAX',
      10,
      MAXIMUM_PRODUCTION_AUTH_RATE_LIMIT_MAX,
      isProduction,
    ),
    authSensitiveRateLimitMax: readAuthSensitiveRateLimitMax(isProduction),
    catalogRateLimitMax: readProductionBoundedRateLimitMax(
      'CATALOG_RATE_LIMIT_MAX',
      20,
      MAXIMUM_PRODUCTION_CATALOG_RATE_LIMIT_MAX,
      isProduction,
    ),
    globalRateLimitMax: readGlobalRateLimitMax(isProduction),
    clientHeaderGuardMode: readClientHeaderGuardMode(isProduction),
    cookieSecure,
    corsOrigin,
    databaseUrl,
    googleOAuthClientId,
    googleOAuthClientSecret,
    googleOAuthRedirectUri,
    headersTimeoutMs: serverTimeouts.headersTimeoutMs,
    host: readHost(),
    importAuthenticatedRateLimitMax: readProductionBoundedRateLimitMax(
      'IMPORT_AUTH_RATE_LIMIT_MAX',
      60,
      MAXIMUM_PRODUCTION_IMPORT_AUTHENTICATED_RATE_LIMIT_MAX,
      isProduction,
    ),
    importGuestRateLimitMax: readProductionBoundedRateLimitMax(
      'IMPORT_GUEST_RATE_LIMIT_MAX',
      20,
      MAXIMUM_PRODUCTION_IMPORT_GUEST_RATE_LIMIT_MAX,
      isProduction,
    ),
    imageProxyRateLimitMax: readProductionBoundedRateLimitMax(
      'IMAGE_PROXY_RATE_LIMIT_MAX',
      120,
      MAXIMUM_PRODUCTION_IMAGE_PROXY_RATE_LIMIT_MAX,
      isProduction,
    ),
    isProduction,
    jsonBodyLimit,
    jwtAccessSecret,
    jwtRefreshSecret,
    keepAliveTimeoutMs: serverTimeouts.keepAliveTimeoutMs,
    logLevel,
    metricsBearerToken,
    metricsEnabled,
    mutationRateLimitMax: readProductionBoundedRateLimitMax(
      'MUTATION_RATE_LIMIT_MAX',
      120,
      MAXIMUM_PRODUCTION_MUTATION_RATE_LIMIT_MAX,
      isProduction,
    ),
    notionRateLimitMax: readProductionBoundedRateLimitMax(
      'NOTION_RATE_LIMIT_MAX',
      20,
      MAXIMUM_PRODUCTION_NOTION_RATE_LIMIT_MAX,
      isProduction,
    ),
    port,
    rateLimitPrefix: readRateLimitPrefix(),
    rateLimitStore,
    rateLimitWindowMs: readProductionBoundedRateLimitMax(
      'RATE_LIMIT_WINDOW_MS',
      60_000,
      MAXIMUM_PRODUCTION_RATE_LIMIT_WINDOW_MS,
      isProduction,
    ),
    readinessCheckTimeoutMs,
    redisUrl,
    requestTimeoutMs: serverTimeouts.requestTimeoutMs,
    securityEventHashSecret,
    swaggerEnabled,
    syncRateLimitMax: readProductionBoundedRateLimitMax(
      'SYNC_RATE_LIMIT_MAX',
      30,
      MAXIMUM_PRODUCTION_SYNC_RATE_LIMIT_MAX,
      isProduction,
    ),
    trustProxyHops,
    urlencodedBodyLimit,
    webBaseUrl,
  };
}

export function readExternalApiKeyEncryptionSecret() {
  const externalApiKeyEncryptionSecret = readProductionSafeSecret(
    'EXTERNAL_API_KEY_ENCRYPTION_SECRET',
  );

  rejectDuplicateProductionSecrets(
    [
      {
        name: 'JWT_ACCESS_SECRET',
        value: process.env.JWT_ACCESS_SECRET?.trim() || null,
      },
      {
        name: 'JWT_REFRESH_SECRET',
        value: process.env.JWT_REFRESH_SECRET?.trim() || null,
      },
      {
        name: 'SECURITY_EVENT_HASH_SECRET',
        value: process.env.SECURITY_EVENT_HASH_SECRET?.trim() || null,
      },
      {
        name: 'METRICS_BEARER_TOKEN',
        value: process.env.METRICS_BEARER_TOKEN?.trim() || null,
      },
      {
        name: 'EXTERNAL_API_KEY_ENCRYPTION_SECRET',
        value: externalApiKeyEncryptionSecret,
      },
    ],
    isProductionEnvironment(),
  );

  return externalApiKeyEncryptionSecret;
}

export function getPublicApiHost(host: string) {
  if (host === '0.0.0.0' || host === '::') {
    return 'localhost';
  }

  return host;
}
