# API Authorization Surface

Status: canonical.
Last reviewed: 2026-06-26.

This document classifies every Nest controller in the API by its intended
authentication boundary. Update it before adding, renaming, or exposing a
controller. `npm run qa:api-auth-surface` blocks unclassified controllers and
high-risk route drift; `npm run qa:image-proxy-policy` blocks image proxy policy
drift for the public cacheable image surface.

## Controller Classification

| Controller | Boundary |
| --- | --- |
| `apps/api/src/modules/auth/auth.controller.ts` | Mixed auth surface. Legacy email/password `register` and `login` return `410 Gone`; Google OAuth start/status/callback are public OAuth endpoints; refresh/logout are refresh-cookie mediated; profile, export, account deletion, and session management routes are protected by `JwtAuthGuard`. |
| `apps/api/src/modules/catalog/catalog.controller.ts` | Class-level protected by `JwtAuthGuard`; catalog reads are authenticated, submissions are current-user scoped, and moderation actions are authorized in `CatalogService`. |
| `apps/api/src/modules/health/health.controller.ts` | Public platform health surface for `/health`, `/livez`, and `/readyz`; do not add user data or secrets. |
| `apps/api/src/modules/image-proxy/image-proxy.controller.ts` | Policy-bounded public image proxy; requests are constrained by `ImageProxyService` URL policy, content type, byte limits, DNS checks, cache headers, and no-sniff response headers. |
| `apps/api/src/modules/imports/imports.controller.ts` | Mixed import surface. Provider credential status/save/delete/test and candidate resolve are protected by `JwtAuthGuard`; provider list and search use optional bearer parsing and must not expose stored credentials to guests. |
| `apps/api/src/modules/notion/notion.controller.ts` | Class-level protected by `JwtAuthGuard`; every connection, test, push, preview, and apply route uses the current authenticated `userId`. |
| `apps/api/src/modules/sync/sync.controller.ts` | Class-level protected by `JwtAuthGuard`; push and pull both use the current authenticated `userId`. |
| `apps/api/src/modules/user-records/user-records.controller.ts` | Class-level protected by `JwtAuthGuard`; record, progress, release view, and import-created record routes use the current authenticated `userId`. |
| `apps/api/src/modules/user-records/user-release-records.controller.ts` | Class-level protected by `JwtAuthGuard`; release record update/delete/restore routes are scoped through owned parent records. |
| `apps/api/src/modules/works/works.controller.ts` | Class-level protected by `JwtAuthGuard`; list, grouped view, detail, create, update, and delete routes use the current authenticated `userId`. |
| `apps/api/src/observability/metrics.controller.ts` | Metrics bearer token surface. Unauthorized reads return `404`, successful reads require `MetricsService.canReadMetrics` with exactly one `Bearer <token>` collector token, and responses are `Cache-Control: no-store`. |

## Release Gate

Run `npm run qa:api-auth-surface` with the commercial repository gates. The
check verifies:

- the controller file list matches this classification;
- class-level protected controllers retain `@UseGuards(JwtAuthGuard)`,
  `@ApiBearerAuth()`, and `CurrentUser` use;
- mixed import/auth route families retain method-level guards or the documented
  optional bearer/refresh-cookie/OAuth behavior;
- required and optional Bearer parsing, `/metrics` collector authorization,
  production client-header guard detection, and authenticated rate-limit user
  keying accept exactly `Bearer <token>` with one non-whitespace token and reject
  extra segments or injected header text;
- provider search/import rate-limit bucket selection treats only verified Work
  Archive access JWTs with the expected algorithm, issuer, audience, required
  registered claims, TTL upper bound, future-issued-token guard, safe identity
  claim shape, and access-token-only claim shape as authenticated traffic, so
  malformed or invalid bearer headers remain on the guest limiter before
  optional bearer parsing handles them;
- protected import candidate resolve traffic is route-specifically rate limited
  before `JwtAuthGuard`, including missing or malformed bearer attempts, so
  protected import abuse does not rely only on the global `/api` limiter;
- catalog traffic is route-specifically rate limited in addition to the shared
  `/api` bucket, so authenticated catalog reads, submissions, and moderation
  endpoints have an independent abuse-control bucket;
- protected work, user-record, and release-record unsafe methods are
  route-specifically rate limited while safe GET/HEAD/OPTIONS requests stay
  outside that mutation bucket;
- public platform health stays public and data-free;
- `/metrics` remains hidden without exactly one valid metrics bearer token;
- the policy-bounded public image proxy still delegates URL enforcement to
  `ImageProxyService`.
- `npm run qa:image-proxy-policy` also passes when image proxy URL, DNS,
  redirect, content-type, cache, and logging behavior changes.

Adding a new controller requires updating this document, the BOLA matrix when
user-owned objects are involved, focused tests for the new boundary, and the
commercial evidence ledger.
