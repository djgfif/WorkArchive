export interface ApiRuntimeConfig {
  corsOrigin: true | string[];
  databaseUrl: string;
  host: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  port: number;
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

function readCorsOrigin(value: string | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue === '*') {
    return true;
  }

  const origins = normalizedValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 0 ? true : origins;
}

export function readApiRuntimeConfig(): ApiRuntimeConfig {
  return {
    corsOrigin: readCorsOrigin(process.env.CORS_ORIGIN),
    databaseUrl: readRequiredEnvString('DATABASE_URL'),
    host: process.env.HOST?.trim() || '0.0.0.0',
    jwtAccessSecret: readRequiredEnvString('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: readRequiredEnvString('JWT_REFRESH_SECRET'),
    port: readPort(process.env.PORT, 3000),
  };
}

export function getPublicApiHost(host: string) {
  if (host === '0.0.0.0' || host === '::') {
    return 'localhost';
  }

  return host;
}
