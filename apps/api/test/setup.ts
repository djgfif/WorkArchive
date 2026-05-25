import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  });
}

process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/work_archive_test?schema=public';
process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET ??=
  'test-external-api-key-secret-minimum-32-chars';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-minimum-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-minimum-32-chars';
process.env.NODE_ENV ??= 'test';
process.env.SECURITY_EVENT_HASH_SECRET ??=
  'test-security-event-secret-minimum-32-chars';
process.env.SWAGGER_ENABLED ??= 'false';
process.env.WEB_BASE_URL ??= 'http://localhost:18730';
