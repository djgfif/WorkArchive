/* global Request, Response, URL */

import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './worker.mjs';

function createEnv() {
  return {
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/index.html') {
          return new Response('<!doctype html><div id="root"></div>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (path === '/assets/app.js') {
          return new Response('console.log("app")', {
            headers: { 'content-type': 'text/javascript' },
          });
        }
        return new Response('Not found', { status: 404 });
      },
    },
  };
}

test('returns a deterministic 503 for API routes', async () => {
  const response = await worker.fetch(
    new Request('https://preview.example/api/auth/refresh'),
    createEnv(),
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await response.json()).code, 'API_NOT_CONFIGURED');
});

test('serves assets and falls back to index.html for browser routes', async () => {
  const env = createEnv();
  const asset = await worker.fetch(
    new Request('https://preview.example/assets/app.js'),
    env,
  );
  const route = await worker.fetch(
    new Request('https://preview.example/works/new', {
      headers: { accept: 'text/html' },
    }),
    env,
  );

  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /console\.log/);
  assert.equal(route.status, 200);
  assert.match(await route.text(), /id="root"/);
  assert.match(
    route.headers.get('content-security-policy') ?? '',
    /frame-ancestors 'none'/,
  );
});

test('preserves a 404 for missing non-HTML resources', async () => {
  const response = await worker.fetch(
    new Request('https://preview.example/missing.json', {
      headers: { accept: 'application/json' },
    }),
    createEnv(),
  );

  assert.equal(response.status, 404);
});
