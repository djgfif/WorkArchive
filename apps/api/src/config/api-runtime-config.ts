export interface ApiRuntimeConfig {
  cookieSecure: boolean;
  corsOrigin: string[];
  databaseUrl: string;
  host: string;
  isProduction: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  passwordResetDevLinksEnabled: boolean;
  port: number;
  swaggerEnabled: boolean;
  webBaseUrl: string;
}

const DEFAULT_PRODUCTION_SECRET_VALUES = new Map([
  [
    'JWT_ACCESS_SECRET',
    [
      'change-me-access-secret',
      'local-compose-access-secret-minimum-32-chars',
    ],
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
]);

const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;

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

  throw new Error('Boolean environment values must be either "true" or "false".');
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

function readCorsOrigin(value: string | undefined, isProduction: boolean) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    if (isProduction) {
      throw new Error('CORS_ORIGIN must be configured in production.');
    }

    return ['http://localhost:8080', 'http://localhost:5173'];
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

  return origins;
}

function readWebBaseUrl(isProduction: boolean) {
  const configuredValue =
    process.env.WEB_BASE_URL?.trim() ||
    process.env.PUBLIC_WEB_BASE_URL?.trim();

  if (configuredValue) {
    return configuredValue;
  }

  if (isProduction) {
    throw new Error('WEB_BASE_URL must be configured in production.');
  }

  return 'http://127.0.0.1:53173';
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
  const isProduction = isProductionEnvironment();
  const cookieSecure = readBoolean(process.env.COOKIE_SECURE, isProduction);
  const databaseUrl = readRequiredEnvString('DATABASE_URL');
  const passwordResetDevLinksEnabled = readBoolean(
    process.env.PASSWORD_RESET_DEV_LINKS_ENABLED,
    false,
  );
  const swaggerEnabled = readBoolean(process.env.SWAGGER_ENABLED, !isProduction);
  const webBaseUrl = readWebBaseUrl(isProduction);

  rejectUnsafeProductionDatabaseUrl(databaseUrl);
  rejectUnsafeProductionSeedDefaults();

  if (isProduction && !cookieSecure) {
    throw new Error('COOKIE_SECURE must not be false in production.');
  }

  if (isProduction && passwordResetDevLinksEnabled) {
    throw new Error(
      'PASSWORD_RESET_DEV_LINKS_ENABLED must not be true in production.',
    );
  }

  if (isProduction && swaggerEnabled) {
    throw new Error('SWAGGER_ENABLED must not be true in production.');
  }

  return {
    cookieSecure,
    corsOrigin: readCorsOrigin(process.env.CORS_ORIGIN, isProduction),
    databaseUrl,
    host: process.env.HOST?.trim() || '0.0.0.0',
    isProduction,
    jwtAccessSecret: readProductionSafeSecret('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: readProductionSafeSecret('JWT_REFRESH_SECRET'),
    passwordResetDevLinksEnabled,
    port: readPort(process.env.PORT, 3000),
    swaggerEnabled,
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
