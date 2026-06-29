#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SECRET_PATTERNS = [
  /^change-me/i,
  /^<.*>$/,
  /^local-compose/i,
  /demo-password/i,
];
const PLACEHOLDER_VALUE_PATTERNS = [
  /^<.*>$/,
  /archive\.example\.com/i,
  /localhost/i,
  /^change-me/i,
  /^local-compose/i,
];
const SECRET_NAMES = new Set([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SECURITY_EVENT_HASH_SECRET',
  'EXTERNAL_API_KEY_ENCRYPTION_SECRET',
]);
const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';
const MAXIMUM_PORT = 65_535;
let env = {};
let errors = [];
let warnings = [];

export function runCommercialEnvPreflight(
  envPath = '.env.prod',
  cwd = process.cwd(),
) {
  const resolvedEnvPath = path.resolve(cwd, envPath);
  const stdout = [];
  const stderr = [];

  errors = [];
  warnings = [];
  env = {};

  if (!fs.existsSync(resolvedEnvPath)) {
    stderr.push(
      JSON.stringify({
        event: 'deploy.env_preflight.failed',
        message: `${envPath} does not exist.`,
      }),
    );

    return formatPreflightResult(1, stdout, stderr);
  }

  env = parseEnvFile(fs.readFileSync(resolvedEnvPath, 'utf8'));

  expectExact('NODE_ENV', 'production');
  expectLogLevel('LOG_LEVEL');
  expectOptionalPort('PORT');
  expectOptionalHost('HOST');
  expectOptionalNoWhitespace('RATE_LIMIT_PREFIX');
  expectOptionalClientHeaderGuardMode('WORK_ARCHIVE_CLIENT_HEADER_GUARD');
  expectPresent('DATABASE_URL');
  expectProductionDatabaseUrl();
  expectNonPlaceholder('GOOGLE_OAUTH_CLIENT_ID');
  expectNonPlaceholder('GOOGLE_OAUTH_CLIENT_SECRET');
  expectExact('RATE_LIMIT_STORE', 'redis');
  expectPresent('REDIS_URL');
  expectProductionRedisUrl();
  expectExact('TRUST_PROXY_HOPS', '1');
  expectExact('COOKIE_SECURE', 'true');
  expectExact('SWAGGER_ENABLED', 'false');
  expectOptionalExact('PASSWORD_RESET_DEV_LINKS_ENABLED', 'false');
  expectPositiveIntegerMax('API_GLOBAL_RATE_LIMIT_MAX', 2000);
  expectOptionalPositiveIntegerMax('AUTH_RATE_LIMIT_MAX', 300);
  expectPositiveIntegerMax('AUTH_SENSITIVE_RATE_LIMIT_MAX', 60);
  expectOptionalPositiveIntegerMax('CATALOG_RATE_LIMIT_MAX', 60);
  expectOptionalPositiveIntegerMax('IMPORT_AUTH_RATE_LIMIT_MAX', 300);
  expectOptionalPositiveIntegerMax('IMPORT_GUEST_RATE_LIMIT_MAX', 60);
  expectOptionalPositiveIntegerMax('IMAGE_PROXY_RATE_LIMIT_MAX', 600);
  expectOptionalPositiveIntegerMax('MUTATION_RATE_LIMIT_MAX', 300);
  expectOptionalPositiveIntegerMax('NOTION_RATE_LIMIT_MAX', 60);
  expectOptionalPositiveIntegerMax('RATE_LIMIT_WINDOW_MS', 300000);
  expectOptionalPositiveIntegerMax('SYNC_RATE_LIMIT_MAX', 300);
  expectPositiveIntegerMax('READINESS_CHECK_TIMEOUT_MS', 5000);
  expectPositiveIntegerMax('API_REQUEST_TIMEOUT_MS', 120000);
  expectPositiveIntegerMax('API_HEADERS_TIMEOUT_MS', 30000);
  expectPositiveIntegerMax('API_KEEP_ALIVE_TIMEOUT_MS', 15000);
  expectOptionalPositiveInteger('PRISMA_CONNECT_TIMEOUT_MS');
  expectServerTimeoutOrdering();
  expectBodySizeLimit('API_JSON_BODY_LIMIT', 5 * 1024 * 1024);
  expectBodySizeLimit('API_URLENCODED_BODY_LIMIT', 256 * 1024);
  expectBoolean('METRICS_ENABLED');
  expectBoolean('METRICS_INTERNAL_ACCESS_REVIEWED');
  expectOptionalNoWhitespace('METRICS_BEARER_TOKEN');
  expectBoolean('IMPORT_SERVER_SEARCH_GUEST_ENABLED');
  expectBoolean('IMPORT_SERVER_SEARCH_GUEST_APPROVED');
  expectBoolean('KOBIS_HTTP_PROVIDER_ENABLED');

  if (
    env.IMPORT_SERVER_SEARCH_GUEST_ENABLED === 'true' &&
    env.IMPORT_SERVER_SEARCH_GUEST_APPROVED !== 'true'
  ) {
    errors.push(
      'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
    );
  }

  if (env.METRICS_ENABLED === 'true') {
    expectExact('METRICS_INTERNAL_ACCESS_REVIEWED', 'true');
    expectPresent('METRICS_BEARER_TOKEN');

    if ((env.METRICS_BEARER_TOKEN?.trim() ?? '').length < 32) {
      errors.push('METRICS_BEARER_TOKEN must be at least 32 characters.');
    }

    if (
      DEFAULT_SECRET_PATTERNS.some((pattern) =>
        pattern.test(env.METRICS_BEARER_TOKEN?.trim() ?? ''),
      )
    ) {
      errors.push(
        'METRICS_BEARER_TOKEN must not use a development/default value.',
      );
    }
  }

  expectProductionHttpsUrl('CORS_ORIGIN');
  expectProductionHttpsUrl('WEB_BASE_URL');
  expectProductionHttpsUrl('GOOGLE_OAUTH_REDIRECT_URI');
  expectExact('VITE_API_BASE_URL', '/api');
  expectWebBaseUrlInCorsOrigin();
  expectGoogleOAuthRedirectUriPath();

  for (const name of SECRET_NAMES) {
    const value = env[name]?.trim() ?? '';

    if (!value) {
      errors.push(`${name} is required.`);
      continue;
    }

    if (value.length < 32) {
      errors.push(`${name} must be at least 32 characters.`);
    }

    if (DEFAULT_SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
      errors.push(`${name} must not use a development/default value.`);
    }
  }

  expectDistinctSecretValues([
    ...SECRET_NAMES,
    ...(env.METRICS_BEARER_TOKEN?.trim() ? ['METRICS_BEARER_TOKEN'] : []),
  ]);

  for (const [name, value] of Object.entries(env).sort()) {
    const printableValue = isSensitiveEnvName(name) ? mask(value) : value;

    stdout.push(`${name}=${printableValue}`);
  }

  for (const warning of warnings) {
    stderr.push(`WARN ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      stderr.push(`ERROR ${error}`);
    }

    return formatPreflightResult(1, stdout, stderr);
  }

  stdout.push('commercial env preflight passed');

  return formatPreflightResult(0, stdout, stderr);
}

function formatPreflightResult(status, stdout, stderr) {
  return {
    status,
    stderr: stderr.length > 0 ? `${stderr.join('\n')}\n` : '',
    stdout: stdout.length > 0 ? `${stdout.join('\n')}\n` : '',
  };
}

function expectDistinctSecretValues(names) {
  const seen = new Map();

  for (const name of names) {
    const value = env[name]?.trim() ?? '';

    if (!value) {
      continue;
    }

    const previousName = seen.get(value);

    if (previousName) {
      errors.push(`${name} must not reuse the same secret value as ${previousName}.`);
      continue;
    }

    seen.set(value, name);
  }
}

const entrypointUrl =
  process.argv[1] === undefined
    ? null
    : pathToFileURL(process.argv[1]).href;

if (entrypointUrl === import.meta.url) {
  const result = runCommercialEnvPreflight(process.argv[2] ?? '.env.prod');

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status);
}

function parseEnvFile(contents) {
  const parsed = {};
  const seenKeys = new Set();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      warnings.push(`Ignoring malformed line: ${trimmed}`);
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const normalizedKey = key.replace(/^export\s+/, '').trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (seenKeys.has(normalizedKey)) {
      errors.push(`${normalizedKey} is defined more than once.`);
    }
    seenKeys.add(normalizedKey);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[normalizedKey] = value;
  }

  return parsed;
}

function expectPresent(name) {
  if (!env[name]?.trim()) {
    errors.push(`${name} is required.`);
  }
}

function expectNonPlaceholder(name) {
  expectPresent(name);

  const value = env[name]?.trim() ?? '';

  if (isPlaceholderValue(value)) {
    errors.push(`${name} must be set to a host-specific production value.`);
  }
}

function expectExact(name, expected) {
  const actual = env[name]?.trim();

  if (actual !== expected) {
    errors.push(`${name} must be ${expected}.`);
  }
}

function expectOptionalExact(name, expected) {
  const actual = env[name]?.trim();

  if (actual && actual !== expected) {
    errors.push(`${name} must be ${expected} when set.`);
  }
}

function expectBoolean(name) {
  const actual = env[name]?.trim();

  if (actual && actual !== 'true' && actual !== 'false') {
    errors.push(`${name} must be true or false when set.`);
  }
}

function expectLogLevel(name) {
  const actual = env[name]?.trim().toLowerCase();

  if (!actual) {
    return;
  }

  if (
    !['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(
      actual,
    )
  ) {
    errors.push(
      `${name} must be one of trace, debug, info, warn, error, fatal, or silent.`,
    );
  }
}

function expectPositiveIntegerMax(name, max) {
  const actual = env[name]?.trim();

  if (!actual) {
    errors.push(`${name} is required.`);
    return;
  }

  if (!/^[1-9]\d*$/.test(actual)) {
    errors.push(`${name} must be a positive integer.`);
    return;
  }

  const value = Number(actual);

  if (!Number.isSafeInteger(value)) {
    errors.push(`${name} must be a safe integer.`);
    return;
  }

  if (value > max) {
    errors.push(`${name} must not exceed ${max}.`);
  }
}

function expectOptionalPositiveInteger(name) {
  const actual = env[name]?.trim();

  if (!actual) {
    return;
  }

  if (!/^[1-9]\d*$/.test(actual)) {
    errors.push(`${name} must be a positive integer.`);
    return;
  }

  const value = Number(actual);

  if (!Number.isSafeInteger(value)) {
    errors.push(`${name} must be a safe integer.`);
  }
}

function expectOptionalPositiveIntegerMax(name, max) {
  const actual = env[name]?.trim();

  if (!actual) {
    return;
  }

  expectPositiveIntegerMax(name, max);
}

function expectOptionalPort(name) {
  const actual = env[name]?.trim();

  if (!actual) {
    return;
  }

  if (!/^[1-9]\d*$/.test(actual)) {
    errors.push(`${name} must be a positive integer.`);
    return;
  }

  const value = Number(actual);

  if (!Number.isSafeInteger(value)) {
    errors.push(`${name} must be a safe integer.`);
    return;
  }

  if (value > MAXIMUM_PORT) {
    errors.push(`${name} must be between 1 and ${MAXIMUM_PORT}.`);
  }
}

function expectOptionalHost(name) {
  const actual = env[name]?.trim();

  if (!actual) {
    return;
  }

  if (/[\s/?#@]/.test(actual)) {
    errors.push(`${name} must be a host or IP address, not a URL.`);
  }
}

function expectOptionalNoWhitespace(name) {
  const actual = env[name]?.trim();

  if (!actual) {
    return;
  }

  if (/\s/.test(actual)) {
    errors.push(`${name} must not contain whitespace.`);
  }
}

function expectOptionalClientHeaderGuardMode(name) {
  const actual = env[name]?.trim().toLowerCase();

  if (!actual) {
    return;
  }

  if (actual !== 'audit' && actual !== 'enforce') {
    errors.push(`${name} must be audit or enforce in production.`);
  }
}

function expectBodySizeLimit(name, maxBytes) {
  const normalizedValue = env[name]?.trim().toLowerCase();

  if (!normalizedValue) {
    errors.push(`${name} is required.`);
    return;
  }

  const match = /^([1-9]\d*)(b|kb|mb)$/.exec(normalizedValue);

  if (!match) {
    errors.push(`${name} must use a positive size ending in b, kb, or mb.`);
    return;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const bytes =
    unit === 'mb'
      ? amount * 1024 * 1024
      : unit === 'kb'
        ? amount * 1024
        : amount;

  if (bytes > maxBytes) {
    errors.push(`${name} must not exceed ${maxBytes} bytes.`);
  }
}

function expectServerTimeoutOrdering() {
  const requestTimeoutMs = readPlainInteger(env.API_REQUEST_TIMEOUT_MS);
  const headersTimeoutMs = readPlainInteger(env.API_HEADERS_TIMEOUT_MS);
  const keepAliveTimeoutMs = readPlainInteger(env.API_KEEP_ALIVE_TIMEOUT_MS);

  if (
    requestTimeoutMs !== null &&
    headersTimeoutMs !== null &&
    headersTimeoutMs > requestTimeoutMs
  ) {
    errors.push(
      'API_HEADERS_TIMEOUT_MS must not exceed API_REQUEST_TIMEOUT_MS.',
    );
  }

  if (
    headersTimeoutMs !== null &&
    keepAliveTimeoutMs !== null &&
    keepAliveTimeoutMs >= headersTimeoutMs
  ) {
    errors.push(
      'API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_HEADERS_TIMEOUT_MS.',
    );
  }
}

function readPlainInteger(value) {
  const actual = value?.trim();

  if (!actual || !/^[1-9]\d*$/.test(actual)) {
    return null;
  }

  const parsedValue = Number(actual);

  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

function expectWebBaseUrlInCorsOrigin() {
  const webBaseUrl = env.WEB_BASE_URL?.trim() ?? '';
  const corsOrigins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!webBaseUrl || corsOrigins.length === 0) {
    return;
  }

  try {
    const webOrigin = new URL(webBaseUrl).origin;
    const allowedOrigins = new Set(
      corsOrigins.map((origin) => new URL(origin).origin),
    );

    if (!allowedOrigins.has(webOrigin)) {
      errors.push('WEB_BASE_URL origin must be included in CORS_ORIGIN.');
    }
  } catch {
    // URL shape errors are reported by expectProductionHttpsUrl.
  }
}

function expectGoogleOAuthRedirectUriPath() {
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? '';

  if (!redirectUri) {
    return;
  }

  try {
    const parsedUrl = new URL(redirectUri);

    if (
      parsedUrl.pathname !== GOOGLE_OAUTH_CALLBACK_PATH ||
      parsedUrl.search !== '' ||
      parsedUrl.hash !== ''
    ) {
      errors.push(
        `GOOGLE_OAUTH_REDIRECT_URI must use ${GOOGLE_OAUTH_CALLBACK_PATH} with no query string or fragment.`,
      );
    }
  } catch {
    // URL shape errors are reported by expectProductionHttpsUrl.
  }
}

function expectProductionDatabaseUrl() {
  const databaseUrlValue = env.DATABASE_URL?.trim() ?? '';

  if (!databaseUrlValue) {
    return;
  }

  try {
    const databaseUrl = new URL(databaseUrlValue);

    if (
      databaseUrl.protocol !== 'postgresql:' &&
      databaseUrl.protocol !== 'postgres:'
    ) {
      errors.push(
        'DATABASE_URL must use the postgresql:// or postgres:// scheme.',
      );
    }

    if (
      decodeURIComponent(databaseUrl.username) === 'postgres' &&
      decodeURIComponent(databaseUrl.password) === 'postgres'
    ) {
      errors.push(
        'DATABASE_URL must not use the postgres/postgres development credential.',
      );
    }

    if (isLocalhostHostname(databaseUrl.hostname)) {
      errors.push('DATABASE_URL must not use localhost.');
    }
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL.');
  }
}

function expectProductionRedisUrl() {
  const redisUrlValue = env.REDIS_URL?.trim() ?? '';

  if (!redisUrlValue) {
    return;
  }

  try {
    const redisUrl = new URL(redisUrlValue);

    if (redisUrl.protocol !== 'redis:' && redisUrl.protocol !== 'rediss:') {
      errors.push('REDIS_URL must be a valid redis:// or rediss:// URL.');
    }

    if (isLocalhostHostname(redisUrl.hostname)) {
      errors.push('REDIS_URL must not use localhost.');
    }
  } catch {
    errors.push('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }
}

function isLocalhostHostname(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}

function isSensitiveEnvName(name) {
  return (
    SECRET_NAMES.has(name) ||
    name.includes('SECRET') ||
    name.includes('PASSWORD') ||
    name.includes('TOKEN') ||
    name.includes('API_KEY') ||
    name === 'DATABASE_URL'
  );
}

function expectHttpsUrl(name) {
  const values = (env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    errors.push(`${name} is required.`);
    return;
  }

  for (const value of values) {
    try {
      const url = new URL(value);

      if (url.protocol !== 'https:') {
        errors.push(`${name} must use https://.`);
      }
    } catch {
      errors.push(`${name} must be a valid URL.`);
    }
  }
}

function expectProductionHttpsUrl(name) {
  expectHttpsUrl(name);

  const values = (env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of values) {
    if (isPlaceholderValue(value)) {
      errors.push(`${name} must be set to a host-specific production URL.`);
    }
  }
}

function isPlaceholderValue(value) {
  return PLACEHOLDER_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function mask(value) {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
