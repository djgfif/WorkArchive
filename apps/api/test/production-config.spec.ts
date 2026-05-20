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
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain('X-Content-Type-Options');
    expect(nginxConfig).toContain('Referrer-Policy');
    expect(nginxConfig).toContain('Permissions-Policy');
  });
});
