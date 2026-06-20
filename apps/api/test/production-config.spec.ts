import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const repoRoot = join(__dirname, '..', '..', '..');

describe('production deployment config', () => {
  it('keeps production API, Redis, and Postgres internal to compose', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );
    const apiService = composeProd.slice(
      composeProd.indexOf('  api:'),
      composeProd.indexOf('  web:'),
    );

    expect(composeProd).toContain('  redis:');
    expect(composeProd).toContain('redis-cli');
    expect(apiService).toContain('redis:');
    expect(apiService).toContain('REDIS_URL: ${REDIS_URL:-redis://redis:6379}');
    expect(apiService).toContain('TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}');
    expect(apiService).toContain(
      'READINESS_CHECK_TIMEOUT_MS: ${READINESS_CHECK_TIMEOUT_MS:-1500}',
    );
    expect(apiService).toContain(
      'API_JSON_BODY_LIMIT: ${API_JSON_BODY_LIMIT:-2mb}',
    );
    expect(apiService).toContain(
      'API_URLENCODED_BODY_LIMIT: ${API_URLENCODED_BODY_LIMIT:-64kb}',
    );
    expect(apiService).toContain(
      'SECURITY_EVENT_HASH_SECRET: ${SECURITY_EVENT_HASH_SECRET:?required}',
    );
    expect(apiService).not.toContain('\n    ports:');
  });

  it('passes Google OAuth secrets only to the production API service', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );
    const apiService = composeProd.slice(
      composeProd.indexOf('  api:'),
      composeProd.indexOf('  web:'),
    );
    const webService = composeProd.slice(composeProd.indexOf('  web:'));

    expect(apiService).toContain(
      'GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID:?required}',
    );
    expect(apiService).toContain(
      'GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET:?required}',
    );
    expect(apiService).toContain(
      'GOOGLE_OAUTH_REDIRECT_URI: ${GOOGLE_OAUTH_REDIRECT_URI:?required}',
    );
    expect(webService).not.toContain('GOOGLE_OAUTH_CLIENT_SECRET');
    expect(webService).not.toContain('VITE_GOOGLE_OAUTH_CLIENT_SECRET');
  });

  it('enables graceful API shutdown hooks and rate-limit Redis cleanup', () => {
    const main = readFileSync(join(repoRoot, 'apps/api/src/main.ts'), 'utf8');
    const securityModule = readFileSync(
      join(repoRoot, 'apps/api/src/security/security.module.ts'),
      'utf8',
    );
    const cleanupService = readFileSync(
      join(
        repoRoot,
        'apps/api/src/security/security-runtime-cleanup.service.ts',
      ),
      'utf8',
    );

    expect(main).toContain("app.enableShutdownHooks(['SIGTERM', 'SIGINT'])");
    expect(main).toContain('bodyParser: false');
    expect(main).toContain(
      "app.useBodyParser('json', { limit: config.jsonBodyLimit })",
    );
    expect(main).toContain("app.useBodyParser('urlencoded'");
    expect(securityModule).toContain('SecurityRuntimeCleanupService');
    expect(cleanupService).toContain('shutdownRedisRateLimitClients');
  });

  it('keeps production healthcheck covered by repo gates and validates response bodies', () => {
    const packageJson = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    const repoGates = readFileSync(
      join(repoRoot, 'scripts/qa/commercial-repo-gates.sh'),
      'utf8',
    );
    const healthcheck = readFileSync(
      join(repoRoot, 'scripts/deploy/prod-healthcheck.sh'),
      'utf8',
    );

    expect(packageJson).toContain(
      '"ops:healthcheck": "scripts/deploy/prod-healthcheck.sh"',
    );
    expect(repoGates).toContain('bash -n scripts/deploy/prod-healthcheck.sh');
    expect(healthcheck).toContain('assert_health_json');
    expect(healthcheck).toContain('data.service !== "work-archive-api"');
    expect(healthcheck).toContain('data.status !== "ok"');
  });

  it('keeps the local Docker API aligned with the web reverse proxy', () => {
    const composeDev = readFileSync(join(repoRoot, 'compose.yml'), 'utf8');
    const apiService = composeDev.slice(
      composeDev.indexOf('  api:'),
      composeDev.indexOf('  web:'),
    );

    expect(apiService).toContain('TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}');
    expect(apiService).toContain(
      'READINESS_CHECK_TIMEOUT_MS: ${READINESS_CHECK_TIMEOUT_MS:-1500}',
    );
    expect(apiService).toContain(
      'API_JSON_BODY_LIMIT: ${API_JSON_BODY_LIMIT:-2mb}',
    );
    expect(apiService).toContain(
      'API_URLENCODED_BODY_LIMIT: ${API_URLENCODED_BODY_LIMIT:-64kb}',
    );
    expect(apiService).toContain('AUTH_RATE_LIMIT_MAX: ${AUTH_RATE_LIMIT_MAX:-120}');
    expect(apiService).toContain('SYNC_RATE_LIMIT_MAX: ${SYNC_RATE_LIMIT_MAX:-120}');
  });

  it('routes /api through NGINX before the SPA fallback and sends security headers', () => {
    const nginxConfig = readFileSync(
      join(repoRoot, 'apps', 'web', 'nginx.conf'),
      'utf8',
    );

    expect(nginxConfig.indexOf('location /api/')).toBeGreaterThan(-1);
    expect(nginxConfig.indexOf('location /api/')).toBeLessThan(
      nginxConfig.indexOf('location / {'),
    );
    expect(nginxConfig).toContain('proxy_pass http://api:3000/api/');
    expect(nginxConfig).toContain('Content-Security-Policy');
    expect(nginxConfig).toContain('connect-src');
    expect(nginxConfig).toContain('https://graphql.anilist.co');
    expect(nginxConfig).toContain('https://archive.org');
    expect(nginxConfig).toContain('https://covers.openlibrary.org');
    expect(nginxConfig).toContain("img-src 'self' data: blob: https:");
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain('X-Content-Type-Options');
    expect(nginxConfig).toContain('Referrer-Policy');
    expect(nginxConfig).toContain('Permissions-Policy');
  });

  it('keeps service-worker runtime caching focused on image-like cover hosts', () => {
    const viteConfig = readFileSync(
      join(repoRoot, 'apps', 'web', 'vite.config.ts'),
      'utf8',
    );

    expect(viteConfig).toContain('wa-external-covers');
    expect(viteConfig).toContain('s4\\\\.anilist\\\\.co');
    expect(viteConfig).not.toContain('(anilist\\\\.co)');
    expect(viteConfig).not.toContain('fonts.googleapis.com');
    expect(viteConfig).not.toContain('cdn.jsdelivr.net');
  });
});
