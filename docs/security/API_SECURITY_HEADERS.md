# API Security Headers

Status: Gate 1 policy baseline.
Last reviewed: 2026-06-25.

The API is normally consumed through the same-origin web deployment, but API
responses still need stable browser-facing security headers. This policy fixes
the backend header baseline that must stay in place for public beta and
commercial operation.

## Runtime Contract

- `apps/api/src/configure-app.ts` must disable `x-powered-by` on the underlying
  Express instance.
- `helmet` must stay installed in `configureApp` with `hidePoweredBy: true`.
- The API CSP must keep `default-src 'none'`, `base-uri 'none'`,
  `form-action 'none'`, `frame-ancestors 'none'`, and `object-src 'none'`.
- API responses must retain `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and Helmet's HSTS header.
- The focused app security e2e test must verify representative API response
  headers so middleware drift is caught before release.
- `scripts/deploy/beta-smoke.sh` must verify the same API security header floor
  through the deployed beta proxy for `/health`, `/livez`, `/readyz`, and
  `/api/auth/google/status`.

These headers do not replace route authorization, CSRF controls, cache-control,
or the web nginx CSP. They are the backend response-header floor for API routes.

## Release Gate

Run this check before public beta approval and after changing app middleware,
Helmet configuration, API prefixing, or the Nest/Express adapter:

```bash
npm run qa:api-security-headers
```

The gate verifies the runtime Helmet wiring, e2e header assertions, beta smoke
coverage, documentation, and commercial Gate 1 wiring.
