export interface ApiRuntimeConfig {
  cookieSecure: boolean;
  corsOrigin: string[];
  databaseUrl: string;
  host: string;
  isProduction: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  port: number;
  swaggerEnabled: boolean;
}

function readRequiredEnvString(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured before the API starts.`);
  }

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

function readCorsOrigin(value: string | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
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

  return origins;
}

export function readApiRuntimeConfig(): ApiRuntimeConfig {
  const isProduction = process.env.NODE_ENV?.trim() === 'production';

  return {
    cookieSecure: readBoolean(process.env.COOKIE_SECURE, isProduction),
    corsOrigin: readCorsOrigin(process.env.CORS_ORIGIN),
    databaseUrl: readRequiredEnvString('DATABASE_URL'),
    host: process.env.HOST?.trim() || '0.0.0.0',
    isProduction,
    jwtAccessSecret: readRequiredEnvString('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: readRequiredEnvString('JWT_REFRESH_SECRET'),
    port: readPort(process.env.PORT, 3000),
    swaggerEnabled: readBoolean(process.env.SWAGGER_ENABLED, !isProduction),
  };
}

export function readExternalApiKeyEncryptionSecret() {
  return readRequiredEnvString('EXTERNAL_API_KEY_ENCRYPTION_SECRET');
}

export function getPublicApiHost(host: string) {
  if (host === '0.0.0.0' || host === '::') {
    return 'localhost';
  }

  return host;
}
