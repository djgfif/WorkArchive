# API Cache Policy

Status: Gate 1 policy baseline.

This is the canonical API cache policy for backend response caching behavior.

Work Archive stores private archive data, account metadata, sync state, provider
diagnostics, and data-rights responses behind API routes. Those API responses
must not be reused from browser, proxy, or intermediary caches unless a route is
explicitly designed as a public cacheable asset surface.

## Default Dynamic Response Rule

All normal `/api/*` responses and operational health responses must receive:

```http
Cache-Control: no-store
```

`apps/api/src/security/security-middleware.ts` owns this default through
`createApiNoStoreMiddleware`, and `apps/api/src/configure-app.ts` installs that
middleware for the application. This keeps authenticated account, sync, import,
Notion, catalog-submission, and user-record responses out of shared caches.
It also keeps `/health`, `/livez`, and `/readyz` from being reused by browser,
proxy, or load-balancer caches while those endpoints report live application
state.

## Current Exceptions

- `/api/image-proxy` is the only current `/api/*` exception. It is a
  policy-bounded public image proxy with its own deterministic public cache
  headers, content-type checks, URL allowlist, DNS/private-address checks, byte
  limits, ETags, and `X-Content-Type-Options: nosniff`.
- `/metrics` sits outside the `/api` prefix and must keep
  `Cache-Control: no-store` on successful collector responses.
- `/health`, `/livez`, and `/readyz` sit outside the `/api` prefix for platform
  health checks, but they are still dynamic no-store responses.

Do not add another cacheable API route without updating this document, the
authorization surface, tests, and the cache-policy validator.
Run `npm run qa:image-proxy-policy` when changing the image proxy exception so
its SSRF, allowlist, content-type, byte-limit, and full-URL logging defenses
remain covered alongside cache behavior.

## Release Gate

Run this check before public beta approval and after changing API middleware,
controllers, image proxy behavior, metrics, healthcheck scripts, or route
prefixing:

```bash
npm run qa:api-cache-policy
npm run qa:image-proxy-policy
```

The gate fails when the default no-store middleware is removed, operational
health endpoints lose no-store coverage, the image proxy cache exception
drifts, metrics lose `no-store`, beta/prod smoke scripts stop checking no-store
headers, regression tests are removed, or commercial readiness evidence no
longer lists the cache policy gate.
