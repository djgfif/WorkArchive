# CSRF Policy

Status: Gate 1 policy baseline.
Last reviewed: 2026-06-25.

This API uses refresh cookies for session rotation and OAuth flow cookies for
Google login. Those cookies are scoped and hardened in the auth session policy;
this document defines the complementary request-boundary controls that must stay
in place for production unsafe requests.

## Runtime Contract

- `apps/api/src/configure-app.ts` must install
  `createProductionFetchMetadataGuard` and `createProductionOriginGuard` before
  the production client-header guard.
- In production, safe methods (`GET`, `HEAD`, and `OPTIONS`) remain outside the
  unsafe request CSRF block so health, OAuth callback `GET`, and normal reads
  keep working through their route-specific auth boundaries.
- Unsafe requests with `Sec-Fetch-Site: cross-site` are rejected before the
  Origin fallback, return a JSON body with `requestId`, and record
  `http.fetch_metadata_blocked`.
- Unsafe requests with `Sec-Fetch-Site: same-origin` may proceed without an
  Origin header because same-origin browser requests can legitimately omit it.
- Unsafe requests with `Sec-Fetch-Site: same-site`, `Sec-Fetch-Site: none`, or
  no Fetch Metadata must present an `Origin` that matches the configured
  production Origin allowlist.
- Missing or unlisted Origins are rejected with a JSON body containing
  `requestId` and record `http.origin_blocked`.
- CORS must keep `credentials: true` and the configured explicit origin
  allowlist; wildcard credentialed CORS is not allowed by production config.
- CORS preflight responses must use an explicit method allowlist
  (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and explicit
  request-header allowlist (`Authorization`, `Content-Type`, `X-Request-Id`,
  `X-Work-Archive-Client`). The API exposes only `X-Request-Id` to browser
  callers and uses a bounded preflight cache max-age.

## Release Gate

Run this check before public beta approval and after changing app middleware,
auth cookies, CORS, or browser-facing unsafe routes:

```bash
npm run qa:csrf-policy
```

The gate verifies middleware ordering, Fetch Metadata behavior, Origin allowlist
behavior, explicit CORS preflight headers, audit event names, focused e2e
coverage, and commercial Gate 1 wiring.
