# Production Rehearsal

Closed beta rehearsal verifies that the existing runtime can be built, started, smoked, backed up, restored, and rolled back without adding new architecture.

Do not add Kafka, Saga orchestration, an API Gateway, Redis general caching, public community features, or email/password login during rehearsal.

## Scope

- Runtime: local-first web app, NestJS API, PostgreSQL, Redis rate limiting, Dexie `syncQueue`.
- Auth: Google OAuth only.
- Product smoke: local archive, sync idempotency, and Tier Board Maker.
- Operations smoke: production compose build/up, health endpoints, backup/restore drill, and log redaction.

## Files

- Compose file: `compose.prod.yml`
- Env template: `.env.prod.example`
- Host-only env file: `.env.prod`
- Deployment scripts:
  - `scripts/deploy/prod-build.sh`
  - `scripts/deploy/prod-up.sh`
  - `scripts/deploy/prod-down.sh`
  - `scripts/deploy/prod-logs.sh`
  - `scripts/deploy/prod-healthcheck.sh`
  - `scripts/deploy/prod-backup.sh`
  - `scripts/deploy/prod-restore.sh.example`
- Readiness report template: `docs/operations/deployment/DEPLOYMENT_READINESS_REPORT.md`
- Closed beta host rehearsal runbook:
  `docs/operations/BETA_HOST_REHEARSAL.md`
- Closed beta host scripts:
  - `scripts/deploy/beta-preflight.sh`
  - `scripts/deploy/beta-smoke.sh`
- Backup policy: `docs/operations/BACKUP_POLICY.md`
- Runbook: `docs/operations/RUNBOOK.md`

## 1. Production Env Preparation

On the deployment or rehearsal host:

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
```

Replace every placeholder in `.env.prod`. Do not commit `.env.prod`.

Required checks:

- `POSTGRES_PASSWORD` is generated and not reused from development.
- `DATABASE_URL` matches `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- JWT, external API key encryption, and security event hash secrets are all unique.
- `CORS_ORIGIN` and `WEB_BASE_URL` use the production HTTPS origin.
- `RATE_LIMIT_STORE=redis` and `REDIS_URL=redis://redis:6379`; confirm
  `IMAGE_PROXY_RATE_LIMIT_MAX` and `NOTION_RATE_LIMIT_MAX` are set for the
  expected public traffic profile.
- `IMPORT_SERVER_SEARCH_GUEST_ENABLED=false`; it is reserved for future server
  credential providers and does not expose Brave/Tavily guest search.
- No OAuth secret, API key, real DB password, token, or cookie value is copied into the readiness report.
- Runtime web feature flag overrides, if needed, are placed in `/work-archive-config.js` and loaded before the React bundle. Do not place secrets in this file.

Validate compose interpolation:

```bash
docker compose -f compose.prod.yml --env-file .env.prod config >/dev/null
```

## 2. Build And Start

Build the production images:

```bash
scripts/deploy/prod-build.sh
```

Start backing services, run migrations, then start the app:

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
docker compose -f compose.prod.yml --env-file .env.prod up -d api web
```

Expected:

- `work-archive-postgres` is healthy.
- `work-archive-redis` is healthy.
- `work-archive-api` is healthy.
- `work-archive-web` is running and exposes `${WEB_PORT:-8080}:8080`.
- `/work-archive-config.js` is served with `Cache-Control: no-store` and is loaded before the module script in `index.html`.

If the API does not become healthy, check:

```bash
TAIL=200 FOLLOW=0 scripts/deploy/prod-logs.sh api
TAIL=100 FOLLOW=0 scripts/deploy/prod-logs.sh postgres
TAIL=100 FOLLOW=0 scripts/deploy/prod-logs.sh redis
```

## 3. Health Smoke

Set the public origin:

```bash
DOMAIN=https://archive.example.com
```

Run:

```bash
HEALTHCHECK_BASE_URL="$DOMAIN" scripts/deploy/prod-healthcheck.sh
```

Expected:

- `/health`: HTTP 200 and basic service status.
- `/livez`: HTTP 200 while the API process is alive.
- `/readyz`: HTTP 200 only when config, PostgreSQL, and Redis are ready.

Failure routing:

- `config`: fix `.env.prod` and restart API.
- `postgres`: follow `docs/operations/RUNBOOK.md`.
- `redis`: confirm Redis is used for rate limiting only, then follow the Redis runbook.

## 4. Google OAuth Production Redirect Checklist

Google Cloud Console:

- OAuth client type is Web application.
- Authorized redirect URI exactly equals `https://archive.example.com/api/auth/google/callback`.
- No localhost redirect is the only configured production URI.
- OAuth consent screen is configured for closed beta testers.

`.env.prod`:

- `GOOGLE_OAUTH_CLIENT_ID` matches the production web client.
- `GOOGLE_OAUTH_CLIENT_SECRET` is present only in `.env.prod` or the host secret store.
- `GOOGLE_OAUTH_REDIRECT_URI` exactly matches the Google Console URI.
- `WEB_BASE_URL` is the production HTTPS web origin.
- `COOKIE_SECURE=true` through `compose.prod.yml`.

Smoke:

1. Open `/auth/login`.
2. Click the Google login action.
3. Confirm `/api/auth/google/start` redirects to Google.
4. Complete login with a beta tester account.
5. Confirm callback returns to `/auth/google/complete`.
6. Confirm `/api/auth/me` returns the authenticated user.
7. Confirm cookies are `HttpOnly`, `Secure`, and not logged.
8. Confirm email/password registration and reset paths still redirect to login.

## 5. PostgreSQL Backup/Restore Drill

Create a backup:

```bash
BACKUP_DIR=backups scripts/deploy/prod-backup.sh
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" scripts/deploy/prod-backup-verify.sh
```

Move the `.dump` and `.sha256` files off-host immediately. A backup kept only
on the database server does not satisfy rehearsal.

Restore drill on a disposable rehearsal database or volume:

```bash
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" scripts/deploy/prod-backup-verify.sh

scripts/deploy/prod-down.sh
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis

docker compose -f compose.prod.yml --env-file .env.prod exec -T postgres sh -lc 'pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$POSTGRES_DB"' < "$BACKUP_FILE"

docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
docker compose -f compose.prod.yml --env-file .env.prod up -d api web
HEALTHCHECK_BASE_URL="$DOMAIN" scripts/deploy/prod-healthcheck.sh
```

`scripts/deploy/prod-restore.sh.example` is intentionally an example only. Use
it as the reviewed procedure for restore drills or approved incidents; do not
commit a production restore script with a selected backup path.

Post-restore smoke:

- Google login succeeds, or users are asked to log in again if the restore point predates their session.
- Sync pull returns existing records.
- New work creation syncs once.
- Replayed `clientMutationId` is idempotent.
- Existing tier boards load.

## 6. Tier Board Smoke Checklist

- If tier boards are disabled for the closed beta cohort, set `window.__WORK_ARCHIVE_CONFIG__ = { featureFlags: { tierBoards: false } };` in `/work-archive-config.js` before opening the app, then confirm `/tier-boards`, `/tier-boards/:boardId`, and `/tier-boards/:boardId/view` redirect to `/works` and tier board navigation is hidden.
- `/tier-boards` opens with `tierBoards` enabled.
- New board can be created.
- Text card can be added.
- Image URL card can be added.
- Uploaded image card respects MIME and size validation.
- Existing work snapshot card can be added.
- Card can move from pool to lane.
- Card can move from lane to pool.
- JSON export succeeds.
- JSON import creates a board without modifying unrelated works.
- PNG export succeeds or shows the documented fallback.
- Source `WorkRecord` `updatedAt` and `serverVersion` do not change from snapshot card movement alone.
- Public community/share feed remains disabled.

## 7. Sync Idempotency Smoke Checklist

Use a beta test account. Do not paste access tokens or cookies into reports.

- Create one work in the web UI.
- Trigger sync and capture the local request body only in a secure local scratch file.
- Re-send the same `/api/sync/push` body with the same `clientMutationId`.
- Expected result is already applied, not a duplicate create.
- Confirm no duplicate work row exists.
- Create one tier board card and repeat the duplicate push test.
- Confirm no duplicate tier board card row exists.
- Confirm `user_sync_applied_mutations` has no duplicate `clientMutationId` per user.

Read-only duplicate check:

```bash
docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''select "userId", "clientMutationId", count(*) from user_sync_applied_mutations group by 1, 2 having count(*) > 1;'\'''
```

Expected: zero rows.

## 8. Log Redaction Checklist

Review API and web logs:

```bash
TAIL=300 FOLLOW=0 scripts/deploy/prod-logs.sh api
TAIL=100 FOLLOW=0 scripts/deploy/prod-logs.sh web
```

Must not appear:

- OAuth authorization code
- OAuth access, ID, or refresh token
- `Authorization` header value
- `Cookie` or `Set-Cookie` header value
- Google OAuth client secret
- Provider API key
- PostgreSQL password
- Raw image data or full data URLs

Should appear when relevant:

- `requestId`
- safe `errorCode`
- `sync.push.completed`
- `health.ready.failed` without secrets
- `imports.provider.failed` without provider credentials

## 9. Rehearsal Exit Criteria

Closed beta is ready only when:

- all npm verification commands pass;
- `scripts/deploy/prod-build.sh` passes;
- compose stack boots on the target host;
- `scripts/deploy/prod-healthcheck.sh` passes for `/health`, `/livez`, and `/readyz`;
- Google OAuth production login succeeds;
- `scripts/deploy/prod-backup.sh` creates a backup that is stored off-host;
- restore drill succeeds on a disposable target;
- tier board smoke passes;
- sync idempotency smoke passes;
- log redaction review passes;
- readiness report is filled with evidence and owner/date.

Shutdown a disposable rehearsal stack:

```bash
docker compose -f compose.prod.yml --env-file .env.prod down
```

Do not remove volumes unless the rehearsal database is intentionally disposable.
