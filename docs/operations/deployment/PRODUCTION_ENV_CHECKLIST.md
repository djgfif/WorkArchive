# Production Environment Checklist

Do not commit `.env.prod`. Keep real secrets outside GitHub and outside exported
JSON backups.

Use this checklist to create `.env.prod` on the deployment host:

```bash
cp .env.example .env.prod
chmod 600 .env.prod
```

## Required Database Values

```bash
POSTGRES_DB=work_archive
POSTGRES_USER=work_archive
POSTGRES_PASSWORD=<generate with: openssl rand -base64 32>
DATABASE_URL=postgresql://work_archive:<same password>@postgres:5432/work_archive?schema=public
```

`DATABASE_URL` must be a valid `postgresql://` or `postgres://` URL and match
the Postgres service credentials. Production API startup and commercial env
preflight reject the development `postgres/postgres` credential and localhost
database hosts.

## Required API Secrets

Generate each value independently:

```bash
openssl rand -base64 48
```

Required keys:

```bash
JWT_ACCESS_SECRET=<generated 48+ byte secret>
JWT_REFRESH_SECRET=<generated 48+ byte secret>
EXTERNAL_API_KEY_ENCRYPTION_SECRET=<generated 48+ byte secret>
SECURITY_EVENT_HASH_SECRET=<generated 48+ byte secret>
```

Do not reuse secrets across fields. Rotate by deploying a planned session reset
window for JWT refresh secret changes.

## Google OAuth

Create an OAuth Web Client in Google Cloud Console.

Authorized redirect URI example:

```text
https://archive.example.com/api/auth/google/callback
```

Environment:

```bash
GOOGLE_OAUTH_CLIENT_ID=<google web client id>
GOOGLE_OAUTH_CLIENT_SECRET=<google web client secret>
GOOGLE_OAUTH_REDIRECT_URI=https://archive.example.com/api/auth/google/callback
```

`GOOGLE_OAUTH_REDIRECT_URI` must exactly match the Google Console Authorized
redirect URI, including scheme, host, path, and trailing slash behavior.
Production API startup fails when either Google OAuth client value is missing;
Google OAuth is the only supported account login path. Production API startup
and commercial env preflight reject placeholder OAuth client values, redirect
URIs that still use this checklist's `archive.example.com` example host,
redirect URIs that do not use `/api/auth/google/callback` exactly, or redirect
URIs that include a query string or fragment.

## Public Origins And URLs

```bash
CORS_ORIGIN=https://archive.example.com
WEB_BASE_URL=https://archive.example.com
VITE_API_BASE_URL=/api
```

For the supported production compose deployment, keep `VITE_API_BASE_URL=/api`
so the web container uses the same-origin NGINX API proxy. `prod-build`,
`prod-up`, `beta-preflight`, and commercial env preflight reject other values.
`prod-build`, `prod-up`, and `prod-down` default to `.env.prod` and
`compose.prod.yml`, but accept `ENV_FILE` and `COMPOSE_FILE` overrides for
production-like rehearsal targets while redacting direct Docker Compose
diagnostics.
Production API startup and commercial env preflight reject a `WEB_BASE_URL`
origin that is not included in the CORS allowlist. They also reject public
origin values that still use this checklist's `archive.example.com` example
host. A separate API origin is a post-Gate-1 architecture change and must update
the reverse proxy, CORS, OAuth redirect, smoke tests, and preflight policy
together.

Refresh session recovery uses a `work_archive_refresh_token` cookie with
`HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/api/auth` in production.
The Google OAuth flow cookie is short-lived, `HttpOnly`, `Secure`,
`SameSite=Lax`, and scoped to `Path=/api/auth/google` so the browser can return
from Google's top-level redirect while keeping the cookie away from unrelated
API paths. For Gate 1, web and API browser traffic must remain same-origin:
browser requests go to `/api/*` on `WEB_BASE_URL` and NGINX forwards them to the
internal API service. A different API origin, including a same-site API
subdomain, is a post-Gate-1 architecture change because refresh-cookie delivery,
CORS, OAuth redirect handling, smoke tests, and CSRF policy must be redesigned
together.

## Production Security Defaults

```bash
HOST=0.0.0.0
RATE_LIMIT_STORE=redis
REDIS_URL=redis://redis:6379
RATE_LIMIT_PREFIX=work-archive:rate-limit:
API_GLOBAL_RATE_LIMIT_MAX=600
AUTH_RATE_LIMIT_MAX=120
AUTH_SENSITIVE_RATE_LIMIT_MAX=20
CATALOG_RATE_LIMIT_MAX=20
IMPORT_AUTH_RATE_LIMIT_MAX=60
IMPORT_GUEST_RATE_LIMIT_MAX=20
IMAGE_PROXY_RATE_LIMIT_MAX=120
MUTATION_RATE_LIMIT_MAX=120
NOTION_RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000
SYNC_RATE_LIMIT_MAX=120
READINESS_CHECK_TIMEOUT_MS=1500
API_REQUEST_TIMEOUT_MS=120000
API_HEADERS_TIMEOUT_MS=15000
API_KEEP_ALIVE_TIMEOUT_MS=5000
API_JSON_BODY_LIMIT=2mb
API_URLENCODED_BODY_LIMIT=64kb
TRUST_PROXY_HOPS=1
COOKIE_SECURE=true
SWAGGER_ENABLED=false
NODE_ENV=production
WORK_ARCHIVE_CLIENT_HEADER_GUARD=audit
```

`TRUST_PROXY_HOPS=1` assumes the API receives requests through the web/reverse
proxy layer. Re-evaluate only if the proxy topology changes.
`HOST` must be a host/IP bind value, not a URL. `REDIS_URL` must be a valid
`redis://` or `rediss://` URL; production API startup and commercial env
preflight reject localhost Redis hosts. `RATE_LIMIT_PREFIX` must not contain
whitespace because it becomes part of Redis rate-limit keys.
All numeric API runtime env values must be plain positive decimal integers with
no unit suffix, decimal point, or exponent notation. `API_GLOBAL_RATE_LIMIT_MAX`
caps aggregate `/api` requests per client window before route-specific auth,
catalog, mutation, sensitive auth, sync, import, image, and Notion limits; production startup and
preflight reject values above 2000. `AUTH_SENSITIVE_RATE_LIMIT_MAX` caps account
data export and account deletion preview/delete requests per client window;
production startup and preflight reject values above 60. Route-specific rate
limit env values are optional because compose supplies defaults, but any value
set in `.env.prod` must still be a plain positive decimal integer within the
production cap: `AUTH_RATE_LIMIT_MAX<=300`,
`CATALOG_RATE_LIMIT_MAX<=60`,
`IMPORT_AUTH_RATE_LIMIT_MAX<=300`, `IMPORT_GUEST_RATE_LIMIT_MAX<=60`,
`IMAGE_PROXY_RATE_LIMIT_MAX<=600`, `MUTATION_RATE_LIMIT_MAX<=300`,
`NOTION_RATE_LIMIT_MAX<=60`,
`RATE_LIMIT_WINDOW_MS<=300000`, and `SYNC_RATE_LIMIT_MAX<=300`.
`READINESS_CHECK_TIMEOUT_MS` bounds each `/readyz` dependency check. Production
startup rejects values above 5000 ms.
`PRISMA_CONNECT_TIMEOUT_MS` is optional and defaults to 10000 ms; if set, it
must be a plain positive integer with no unit suffix or decimal.
`API_REQUEST_TIMEOUT_MS`, `API_HEADERS_TIMEOUT_MS`, and
`API_KEEP_ALIVE_TIMEOUT_MS` are applied to the underlying Node HTTP server.
Production startup and `commercial-env-preflight` reject request timeouts above
120000 ms, header timeouts above 30000 ms, keep-alive timeouts above 15000 ms,
headers timeouts greater than request timeouts, and keep-alive timeouts greater
than or equal to header timeouts.
`API_JSON_BODY_LIMIT` and `API_URLENCODED_BODY_LIMIT` must use `b`, `kb`, or
`mb` units. Production startup rejects JSON body limits above 5 MiB and
URL-encoded body limits above 256 KiB.
Keep `WORK_ARCHIVE_CLIENT_HEADER_GUARD=audit` for the first production rollout;
switch it to `enforce` only after security events show no legitimate
authenticated unsafe requests are missing `X-Work-Archive-Client: web`.

Production compose runs API, migration, retention cleanup, and web application
containers with read-only runtime filesystems, tmpfs scratch paths, dropped
Linux capabilities, no-new-privileges, and resource limits. Postgres and Redis
remain writable for their data volumes, but stay internal-only and
resource-bounded. `npm run qa:compose-hardening` blocks drift in these local
production compose requirements. Migrations are not run in the API entrypoint;
run the release profile job before rolling the app:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
```

## Backup And Restore

Before any production deployment with Prisma migration, Dexie version migration,
or sync schema risk, create a PostgreSQL backup and verify the checksum sidecar:

```bash
BACKUP_DIR=backups npm run ops:backup
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" npm run ops:backup:verify
```

Move the `.dump` and `.sha256` files off-host immediately. Do not keep the only
backup on the same VPS, disk, or PostgreSQL volume. Before public beta approval,
generate a non-destructive restore plan, then restore one verified backup into a
disposable/non-production target with the scripted restore drill:

```bash
RESTORE_DRILL_PLAN_ONLY=true \
ENV_FILE=.env.restore \
RESTORE_DRILL_BASE_URL=http://127.0.0.1:8080 \
npm run ops:restore-drill
```

```bash
RESTORE_DRILL_CONFIRM=restore-disposable-target \
ENV_FILE=.env.restore \
RESTORE_DRILL_BASE_URL=http://127.0.0.1:8080 \
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump \
npm run ops:restore-drill
```

Use only a disposable restore target for `.env.restore`; the scripted drill
passes that same restore env into post-restore smoke so it validates the
restored stack, not production.

Record only redacted `tmp/backups/prod-backup-*.md`,
`tmp/backups/prod-backup-verify-*.md`, and
`tmp/restore-drills/restore-drill-plan-*.md` /
`tmp/restore-drills/restore-drill-*.md` summaries in the Gate 1 evidence
ledger. The plan-only report is a review aid and does not replace the real
restore-drill report.

## Operational Retention

Defaults:

```bash
RETENTION_SECURITY_EVENT_DAYS=180
RETENTION_REVOKED_REFRESH_SESSION_DAYS=30
RETENTION_EXPIRED_REFRESH_SESSION_DAYS=30
RETENTION_CLEANUP_DRY_RUN=true
```

Retention cleanup targets `security_events`, `user_refresh_sessions`,
`user_sync_applied_mutations`, and `notion_pull_preview_snapshots`.
`user_sync_applied_mutations` and `notion_pull_preview_snapshots` are deleted by
their row-level `expiresAt` values.

Production deletion requires:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

`RETENTION_CLEANUP_DRY_RUN` accepts only explicit boolean values (`true` or
`false`). Aliases such as `1`, `0`, `yes`, `no`, `on`, or `off` fail before
cleanup targets are counted or deleted.

Run a dry-run first and review matched counts:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

## Search Provider Keys

Cost-bearing import provider keys are user-scoped. Users enter Brave Search,
Tavily Search, Naver, Kakao, Aladin, TMDB, and KOBIS keys in Settings; values
are encrypted with `EXTERNAL_API_KEY_ENCRYPTION_SECRET`.

```bash
IMPORT_SERVER_SEARCH_GUEST_ENABLED=false
IMPORT_SERVER_SEARCH_GUEST_APPROVED=false
```

`IMPORT_SERVER_SEARCH_GUEST_ENABLED` is reserved for future server-credential
providers. It does not expose Brave Search or Tavily Search to guests. In
production, the backend only enables guest server-credential search when both
`IMPORT_SERVER_SEARCH_GUEST_ENABLED=true` and
`IMPORT_SERVER_SEARCH_GUEST_APPROVED=true` are set; `commercial-env-preflight`
rejects an enabled deployment without the approval flag. Keep both values
`false` for public beta unless the operator ledger records the provider owner,
quota, cost boundary, and fallback plan.

KOBIS upstream search is HTTP-only in the current provider implementation and
uses a query parameter API key because the provider API requires it. Keep it
user-scoped, avoid guest exposure, and deploy only where outbound traffic stays
inside an acceptable network boundary.

## Final Preflight

```bash
scripts/deploy/commercial-env-preflight.mjs .env.prod
docker compose -f compose.prod.yml --env-file .env.prod config
```

Confirm no secret values are pasted into issue trackers, deployment reports, or
GitHub comments.

`METRICS_ENABLED` defaults to `false`. Set it to `true` only when `/metrics` is
restricted to an internal collector or allowlisted monitoring path and
`METRICS_INTERNAL_ACCESS_REVIEWED=true` has been set by the release owner.
Production startup and commercial env preflight reject `METRICS_ENABLED=true`
without that explicit review flag. `METRICS_BEARER_TOKEN` must be configured for
the collector, and the token must be a single bearer-token value without
whitespace. Public unauthenticated smoke should still observe `/metrics` as
`404`.
