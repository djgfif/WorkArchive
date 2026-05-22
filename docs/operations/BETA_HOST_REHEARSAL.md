# Closed Beta Host Rehearsal

This runbook verifies that P0/P1 changes work on the actual beta host without
changing the application runtime. It assumes `compose.prod.yml`, `.env.prod`,
and the existing API/web images are used as-is.

Do not paste real secrets, cookies, OAuth codes, access tokens, or backup files
into tickets or reports. Do not assume any command below has already been run on
the production beta host.

## 1. Production Env Preflight

Create the host-only env file:

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
```

Replace every placeholder. Then run the preflight:

```bash
scripts/deploy/beta-preflight.sh
```

The script checks, without printing secret values:

- required `.env.prod` keys are present and not placeholders;
- public URLs use HTTPS;
- `CORS_ORIGIN` and `WEB_BASE_URL` match for the single-host beta deployment;
- `GOOGLE_OAUTH_REDIRECT_URI` equals
  `${WEB_BASE_URL}/api/auth/google/callback`;
- `VITE_API_BASE_URL=/api`;
- `RATE_LIMIT_STORE=redis`, `REDIS_URL=redis://redis:6379`,
  `TRUST_PROXY_HOPS=1`;
- `IMPORT_SERVER_SEARCH_GUEST_ENABLED=false`;
- production secrets are host-generated and at least 32 characters;
- `compose.prod.yml` forces `COOKIE_SECURE=true` and
  `SWAGGER_ENABLED=false`;
- API/web CPU, memory, and PID limits remain present;
- read-only services keep tmpfs scratch paths;
- `docker compose -f compose.prod.yml --env-file .env.prod config` validates.

If Docker is not installed or the current user cannot access it, the script
records the compose validation as skipped. Run that exact compose command on the
beta host before starting the stack.

## 2. Compose Rehearsal Order

Validate interpolation first:

```bash
docker compose -f compose.prod.yml --env-file .env.prod config >/dev/null
```

Build images:

```bash
scripts/deploy/prod-build.sh
```

Start only backing services:

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis
docker compose -f compose.prod.yml --env-file .env.prod ps
```

Run release migrations through the `release` profile:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
```

Start the API and web:

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d api web
docker compose -f compose.prod.yml --env-file .env.prod ps
```

Run maintenance only after API/web readiness is known. The default is dry-run:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

Expected profile order:

1. `api-migrate` with `--profile release`
2. `api`
3. `web`
4. `retention-cleanup` with `--profile maintenance`

## 3. Runtime Smoke Test

Use the public beta origin:

```bash
BETA_BASE_URL=https://archive.example.com scripts/deploy/beta-smoke.sh
```

For a local rehearsal host that still uses the compose port, omit
`BETA_BASE_URL`; the script falls back to `http://127.0.0.1:${WEB_PORT:-8080}`
when `.env.prod` still contains the example domain.

The default smoke checks:

- `GET /health` returns API status;
- `GET /livez` returns API liveness;
- `GET /readyz` returns API readiness after config, PostgreSQL, and Redis;
- `GET /api/auth/google/status` returns `{ configured: true }` by default;
- `GET /` serves the web static app;
- `GET /work-archive-config.js` is served with `Cache-Control: no-store`;
- `POST /api/auth/refresh` without OAuth cookies returns `401` and does not set
  a refresh cookie;
- the `/api` reverse proxy path works through the web service;
- when Docker is available, API, web, and retention containers can write to
  expected tmpfs paths and cannot write to read-only runtime paths.

If Google OAuth is intentionally not configured in a non-production rehearsal,
run:

```bash
EXPECT_GOOGLE_OAUTH_CONFIGURED=false BETA_BASE_URL=http://127.0.0.1:8080 scripts/deploy/beta-smoke.sh
```

Operator-only/dev authenticated sync validation is optional because it needs an
access token from a beta tester session. Do not paste the token into logs:

```bash
SMOKE_ACCESS_TOKEN=<access-token> BETA_BASE_URL=https://archive.example.com scripts/deploy/beta-smoke.sh
```

That extra check sends a structurally valid `/api/sync/push` request with a
malformed `payload` and expects the result code to be `failed_validation`.

## 4. Backup And Restore Drill

Create a backup:

```bash
BACKUP_DIR=backups scripts/deploy/prod-backup.sh
```

Move the backup off-host immediately. A backup that only exists on the database
host does not satisfy the drill.

Non-production restore drill only:

```bash
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump

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
```

Post-restore order:

1. Run `docker compose ... --profile release run --rm api-migrate`.
2. Run `BETA_BASE_URL=<restore-host-url> scripts/deploy/beta-smoke.sh`.
3. Run the operator-only sync malformed payload check in a non-production
   account if an access token is available.

## 5. Retention Dry-Run Verification

Production dry-run:

```bash
RETENTION_CLEANUP_DRY_RUN=true \
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

Deletion confirmation requires both flags:

```bash
RETENTION_CLEANUP_DRY_RUN=false \
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data \
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

Expected log shape:

```json
{"deleted":0,"description":"security_events created before ...","dryRun":true,"event":"operations.retention_cleanup.target","matched":0,"target":"security_events"}
{"deleted":0,"description":"user_refresh_sessions revoked or expired beyond retention cutoffs","dryRun":true,"event":"operations.retention_cleanup.target","matched":0,"target":"user_refresh_sessions"}
{"deleted":0,"description":"password_reset_tokens used or expired beyond retention cutoffs","dryRun":true,"event":"operations.retention_cleanup.target","matched":0,"target":"password_reset_tokens"}
{"deleted":0,"dryRun":true,"event":"operations.retention_cleanup.completed","matched":0,"target":"all"}
```

In deletion mode, `dryRun` must be `false` and `deleted` must match the reviewed
operator expectation before closing the maintenance ticket.
