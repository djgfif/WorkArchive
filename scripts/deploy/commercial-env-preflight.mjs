#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const envPath = process.argv[2] ?? '.env.prod';
const resolvedEnvPath = path.resolve(process.cwd(), envPath);
const DEFAULT_SECRET_PATTERNS = [
  /^change-me/i,
  /^local-compose/i,
  /demo-password/i,
];
const SECRET_NAMES = new Set([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SECURITY_EVENT_HASH_SECRET',
  'EXTERNAL_API_KEY_ENCRYPTION_SECRET',
]);
const errors = [];
const warnings = [];

if (!fs.existsSync(resolvedEnvPath)) {
  console.error(
    JSON.stringify({
      event: 'deploy.env_preflight.failed',
      message: `${envPath} does not exist.`,
    }),
  );
  process.exit(1);
}

const env = parseEnvFile(fs.readFileSync(resolvedEnvPath, 'utf8'));

expectExact('NODE_ENV', 'production');
expectPresent('DATABASE_URL');
expectExact('RATE_LIMIT_STORE', 'redis');
expectPresent('REDIS_URL');
expectExact('TRUST_PROXY_HOPS', '1');
expectExact('COOKIE_SECURE', 'true');
expectExact('SWAGGER_ENABLED', 'false');
expectPositiveIntegerMax('READINESS_CHECK_TIMEOUT_MS', 5000);
expectBodySizeLimit('API_JSON_BODY_LIMIT', 5 * 1024 * 1024);
expectBodySizeLimit('API_URLENCODED_BODY_LIMIT', 256 * 1024);
expectBoolean('METRICS_ENABLED');
if (env.METRICS_ENABLED === 'true') {
  expectExact('METRICS_INTERNAL_ACCESS_REVIEWED', 'true');
  expectPresent('METRICS_BEARER_TOKEN');

  if ((env.METRICS_BEARER_TOKEN?.trim() ?? '').length < 32) {
    errors.push('METRICS_BEARER_TOKEN must be at least 32 characters.');
  }
}
expectHttpsUrl('CORS_ORIGIN');
expectHttpsUrl('WEB_BASE_URL');
expectHttpsUrl('GOOGLE_OAUTH_REDIRECT_URI');

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

for (const [name, value] of Object.entries(env).sort()) {
  const printableValue = isSensitiveEnvName(name) ? mask(value) : value;

  console.log(`${name}=${printableValue}`);
}

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }

  process.exit(1);
}

console.log('commercial env preflight passed');

function parseEnvFile(contents) {
  const parsed = {};

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
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function expectPresent(name) {
  if (!env[name]?.trim()) {
    errors.push(`${name} is required.`);
  }
}

function expectExact(name, expected) {
  const actual = env[name]?.trim();

  if (actual !== expected) {
    errors.push(`${name} must be ${expected}.`);
  }
}

function expectBoolean(name) {
  const actual = env[name]?.trim();

  if (actual && actual !== 'true' && actual !== 'false') {
    errors.push(`${name} must be true or false when set.`);
  }
}

function expectPositiveIntegerMax(name, max) {
  const actual = env[name]?.trim();

  if (!actual) {
    errors.push(`${name} is required.`);
    return;
  }

  const value = Number(actual);

  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer.`);
    return;
  }

  if (value > max) {
    errors.push(`${name} must not exceed ${max}.`);
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

function mask(value) {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
