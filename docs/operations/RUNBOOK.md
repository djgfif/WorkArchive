# Work Archive Operations Runbook

This runbook keeps the current runtime: local-first web app, NestJS API, PostgreSQL, Redis rate limit, and Dexie `syncQueue`.

Commercial readiness references:

- `docs/commercial/COMMERCIAL_LAUNCH_READINESS.md`
- `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`
- `docs/operations/OBSERVABILITY.md`
- `docs/operations/deployment/BETA_REHEARSAL.md`
- `docs/security/SECURE_SDLC.md`

## API가 안 뜰 때

1. Check container or process status.
   - Docker: `docker compose ps`
   - Local: confirm the API `npm run dev --workspace @work-archive/api` process is still running.
2. Check startup logs for config validation errors.
3. Verify required environment values: `DATABASE_URL`, JWT secrets, `SECURITY_EVENT_HASH_SECRET`, `EXTERNAL_API_KEY_ENCRYPTION_SECRET`, Google OAuth settings, and CORS/web base URLs.
4. Confirm the API port is not already occupied.
5. Run `/health` after restart. If `/health` is OK but `/readyz` fails, use the readiness section below.

If startup fails with an `API_*_TIMEOUT_MS` validation error, keep the
production defaults unless the reverse proxy and beta smoke report justify a
change. Request timeout must be at least the header timeout, and keep-alive
timeout must stay below the header timeout.
`PRISMA_CONNECT_TIMEOUT_MS` is optional and defaults to 10000 ms; if set, it
must be a plain positive integer with no unit suffix or decimal.
The same plain positive integer rule applies to API runtime numeric env values
such as `PORT`, `READINESS_CHECK_TIMEOUT_MS`, timeout values, and rate-limit
counts; exponent notation and unit suffixes fail startup validation.

## 운영 로그 확인

Use the redacted operator log helper for production log review:

```bash
TAIL=200 FOLLOW=false npm run ops:logs -- api
```

The helper redacts URL credentials, bearer/basic credentials, secret-like
environment values, database/Redis URL credentials, and sensitive query
parameters including OAuth codes, state, nonce, ID tokens, refresh tokens, and
session values by default. It also redacts those names when they appear as
standalone `key=value` fragments in diagnostics. Raw logs require both
`PROD_LOGS_RAW=true` and
`PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs`; keep raw output local
to incident inspection and manually redact it before sharing.

## `/readyz` 503일 때

`/readyz` checks runtime config, PostgreSQL, Prisma migration state, and Redis
when `REDIS_URL` is configured.

1. Read the JSON response `checks` field and copy `requestId` from the failed
   response.
2. Search API logs for the same `requestId` and the `health.ready.failed`
   structured event. The response and logs intentionally include only the failed
   dependency names, not raw database, Redis, or config error text.
3. If `config` is listed, fix the missing or invalid environment variable and restart.
4. If `postgres` is listed, follow the PostgreSQL 장애 section.
5. If `migrations` is listed, run the release/local migration job, confirm every
   migration directory in the running API image exists in `_prisma_migrations`
   with `finished_at` set, and inspect for failed rows before starting the API
   again.
6. If `redis` is listed, follow the Redis 장애 section.
7. After mitigation, re-run:
   - `curl -fsS http://localhost:18731/health`
   - `curl -fsS http://localhost:18731/livez`
   - `curl -fsS http://localhost:18731/readyz`
   - `HEALTHCHECK_BASE_URL=http://localhost:18731 npm run ops:healthcheck`

## Metrics and alerts

`/metrics` is disabled by default with `METRICS_ENABLED=false`. Enable it only
behind an internal network, reverse-proxy allowlist, or trusted monitoring
collector, and set `METRICS_BEARER_TOKEN` for the collector. Unauthenticated
public requests should return `404` even when the collector path returns `200`.
See `docs/operations/OBSERVABILITY.md` for metric names, alert rules, SLO rules,
dashboard provisioning, and validation commands.

## API 종료와 재시작

The API enables Nest shutdown hooks for `SIGTERM` and `SIGINT`. During normal
container stop or process interrupt, module shutdown closes Prisma/PostgreSQL
connections and the Redis-backed rate-limit store clients.

Operational expectations:

- prefer `docker compose stop api` or the orchestrator's normal rolling-restart
  command over killing the process;
- keep `API_REQUEST_TIMEOUT_MS`, `API_HEADERS_TIMEOUT_MS`, and
  `API_KEEP_ALIVE_TIMEOUT_MS` bounded so slow-open or idle requests do not keep
  connections around indefinitely during traffic spikes;
- inspect shutdown logs if the process exceeds the orchestrator grace period;
- if Redis `QUIT` fails during shutdown, the API falls back to disconnecting the
  rate-limit client so the process can continue terminating;
- after restart, verify `/livez` and `/readyz` before sending traffic.

## Client header guard audit to enforce

`WORK_ARCHIVE_CLIENT_HEADER_GUARD` controls the production bearer-token client
header guard in `apps/api/src/security/security-middleware.ts`.

Modes:

- `off`: do not check `x-work-archive-client`.
- `audit`: record missing or invalid headers, but allow the request.
- `enforce`: reject unsafe authenticated requests missing
  `x-work-archive-client: web` with `403`.

Production compose intentionally defaults to audit:

```bash
WORK_ARCHIVE_CLIENT_HEADER_GUARD=${WORK_ARCHIVE_CLIENT_HEADER_GUARD:-audit}
```

Do not switch directly from unset/off to enforce. Use this promotion sequence:

1. Deploy with `WORK_ARCHIVE_CLIENT_HEADER_GUARD=audit`.
2. Confirm the current web build sends `x-work-archive-client: web` on
   authenticated unsafe API calls.
3. Observe security audit logs for `http.client_header_missing`.
   When metrics are enabled for an internal collector, compare
   `work_archive_client_header_guard_total{result="missing"}` against
   `work_archive_client_header_guard_total{result="accepted"}` by `mode`.
4. Classify every event by source:
   - expected legacy client or stale tab;
   - manual API/script integration;
   - likely CSRF-style or untrusted caller;
   - unknown.
5. Keep audit mode until legitimate web traffic produces zero
   `http.client_header_missing` events, and the client header guard metric shows
   no legitimate `missing` results, for one full release observation window.
6. Announce the cutoff for scripts or integrations that use bearer tokens.
7. Set `WORK_ARCHIVE_CLIENT_HEADER_GUARD=enforce` in staging first and run auth,
   works mutation, sync push, import credential, and logout smoke tests.
8. Promote enforce to production only after staging has no legitimate missing
   header events.
9. After production promotion, monitor `http.client_header_missing`,
   `work_archive_client_header_guard_total{result="missing"}`, and `403` rates.
   Roll back to `audit` if legitimate first-party traffic is blocked.

Expected log event:

```json
{
  "eventType": "http.client_header_missing",
  "metadata": {
    "hasAuthorization": true,
    "headerValue": "missing",
    "method": "POST",
    "mode": "audit",
    "path": "/api/..."
  }
}
```

Enforce readiness criteria:

- no legitimate first-party web requests emit `http.client_header_missing`;
- remaining events are malicious, unknown, stale clients, or approved blocked
  scripts;
- deploy notes include the audit window, count, and decision owner.

## PostgreSQL 장애

1. Confirm the database process is running: `docker compose ps postgres`.
2. Check connectivity using the same `DATABASE_URL` as the API.
3. Inspect disk pressure and recent container logs.
4. Do not run destructive migrations as a recovery step.
5. If data corruption or accidental deletion is suspected, stop writes, take a fresh copy of current data if possible, and start restore from the latest verified backup.
6. After recovery, run `/readyz` and a sync smoke test.

## Redis 장애

Redis is used for rate limiting only. It is not a durable data store and must not be used as a general cache.

1. Confirm Redis is running: `docker compose ps redis`.
2. Check `REDIS_URL` and network reachability from the API container.
3. Restart Redis if it is unavailable.
4. If Redis cannot be restored quickly, decide whether to temporarily run with memory rate limiting for a single-node emergency deployment. Document the change and revert it after Redis recovery.
5. Re-run `/readyz`.

## Google OAuth 실패

1. Confirm `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and web base URL values.
2. Compare the configured redirect URI with the Google Cloud OAuth client exactly.
3. Check browser callback URL and API auth logs without logging codes or tokens.
4. Confirm cookies are set with the expected secure/same-site behavior for the environment.
5. Verify legacy email/password routes still redirect and are not exposed as login options.

## Sync conflict 증가

1. Check recent API logs for sync validation errors, schema version mismatches, and duplicate `clientMutationId` handling.
2. Confirm the web build and API build are from compatible releases.
3. Inspect whether a Dexie version migration or sync `schemaVersion` changed in the release.
4. Pause rollout if conflicts started after deployment.
5. Ask affected users to export local JSON before attempting repair.
6. Prefer additive server fixes over client data rewrites.

## Provider circuit breaker OPEN 지속

1. Identify the provider in diagnostics.
2. Check whether provider credentials exist and are valid.
3. Verify upstream provider status, rate limits, and response shape changes.
4. Confirm API logs do not include provider API keys or raw image payloads.
5. If one provider remains open, leave fallback providers enabled and communicate degraded search/import coverage.
6. After confirming the provider or parser issue is fixed, dry-run the operator
   circuit clear:

   ```bash
   IMPORT_PROVIDER_CIRCUIT_PROVIDER=wikidata \
     npm run ops:imports:clear-circuit --workspace @work-archive/api
   ```

7. To clear a Redis-backed circuit without restarting API instances, run the
   real command from the release/operator environment:

   ```bash
   IMPORT_PROVIDER_CIRCUIT_PROVIDER=wikidata \
   IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN=false \
   IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM=clear-import-provider-circuit \
     npm run ops:imports:clear-circuit --workspace @work-archive/api
   ```

   `IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN` accepts only explicit boolean values
   (`true` or `false`). Aliases such as `1`, `0`, `yes`, `no`, `on`, or `off`
   fail before Redis state is read or cleared.

8. Re-run `/api/imports/providers` or a provider-specific smoke test and keep
   fallback providers enabled until the provider is stable.
9. Release a parser or credential handling fix only after provider-specific smoke testing.

Provider network facts verified in code:

- all providers use `fetchJson` with `AbortController` timeout. Default timeout
  is 5 seconds unless the provider call passes a narrower value.
- one import search runs at most 3 provider lookups concurrently, so a single
  request cannot fan out to every upstream provider at once.
- HTTP 429 `Retry-After` is retried once only when the provider-specific
  `retryAfterMaxMs` allows it.
- repeated failures open a per-provider circuit after 3 failures for a 60 second
  cooldown.
- provider circuit state and provider search cache use Redis when `REDIS_URL`
  is configured. Non-production environments can fall back to process memory;
  a separate operator command cannot clear that in-memory state.
- KOBIS currently uses an upstream HTTP endpoint and sends the user-scoped API
  key as the `key` query parameter. Guest access remains disabled. In
  production, KOBIS is disabled unless `KOBIS_HTTP_PROVIDER_ENABLED=true` is
  explicitly set.
- Enable KOBIS only when the deployment egress path is controlled and approved
  for HTTP query-string credentials, for example through a trusted network or
  sanitizing outbound proxy. If enabled, monitor provider failures and avoid
  logging full upstream URLs because the query string contains the user key.

Redis circuit notes:

1. Store `provider`, `consecutiveFailures`, `openedUntil`, and `reasonCode` in
   Redis with a TTL tied to the open window.
2. Expose circuit state in `/imports/providers` from Redis first, falling back
   to process memory only when Redis is not configured.
3. Failure counts are incremented with a Lua script that updates count TTL and
   circuit state atomically, so concurrent API instances share the same
   threshold.

## DB migration 실패

Production migration policy: API startup must not run Prisma migrations.
`apps/api/docker-entrypoint.sh` only starts the API. Run migrations as a release
job before app rollout:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
```

For public beta candidates, run the full rehearsal first:

```bash
scripts/deploy/commercial-beta-rehearsal.sh .env.prod
```

For rehearsal targets that do not use the default production file names, set
`ENV_FILE` and `COMPOSE_FILE` for `prod-build`, `prod-up`, and `prod-down`.
Those scripts and `commercial-beta-rehearsal.sh` redact direct Docker Compose
diagnostics before they are copied into incident or release notes.

1. Stop the rollout and keep the previous application version running if possible.
2. Check whether the migration partially applied in `_prisma_migrations`.
3. Do not edit production data manually without a written recovery plan.
4. Restore from the pre-deployment backup if the migration changed data destructively or left the schema unusable.
5. For non-destructive failures, fix the migration in a new migration and re-run deploy after review.
6. Record the failure and mitigation in release notes.

The previous pattern of running migrations inside the API entrypoint couples
schema changes to every replica start. That can cause concurrent migration
attempts, crash loops before the app binds health endpoints, and ambiguous
rollback behavior. Keep migration as a one-off release command.

## Retention cleanup

Long-lived operational tables are cleaned by an explicit command, not by request
handlers:

```bash
npm run ops:retention:cleanup --workspace @work-archive/api
```

Production compose equivalent:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

Default mode is dry-run. To delete in production:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

`RETENTION_CLEANUP_DRY_RUN` accepts only explicit boolean values (`true` or
`false`). Aliases such as `1`, `0`, `yes`, `no`, `on`, or `off` fail before
cleanup targets are counted or deleted.

Retention env defaults:

- `security_events`: `RETENTION_SECURITY_EVENT_DAYS=180`
- `user_refresh_sessions`: `RETENTION_REVOKED_REFRESH_SESSION_DAYS=30`
- `user_refresh_sessions`: `RETENTION_EXPIRED_REFRESH_SESSION_DAYS=30`
- `user_sync_applied_mutations`: deleted by each row's `expiresAt`
- `notion_pull_preview_snapshots`: deleted by each row's `expiresAt`

Safety expectations:

- the command logs matched and deleted counts per table;
- every delete uses a cutoff predicate on `createdAt`, `revokedAt`, `expiresAt`,
  or `usedAt`;
- expired Notion pull preview snapshots are deleted by their per-row `expiresAt`
  timestamp, not by a days-based retention setting;
- production delete mode refuses to run without the confirmation value above;
- first run after a release should be dry-run and reviewed before enabling
  deletion.

## Backup restore 절차

Public beta requires one backup restore into a disposable, non-production target.
Create and verify the backup first:

```bash
BACKUP_DIR=backups npm run ops:backup
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump npm run ops:backup:verify
```

Use the scripted drill when possible so checksum verification, `pg_restore`,
release migrations, startup, and smoke evidence are recorded in redacted
reports:

```bash
RESTORE_DRILL_CONFIRM=restore-disposable-target \
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump \
ENV_FILE=.env.restore \
RESTORE_DRILL_BASE_URL=https://restore.example.com \
npm run ops:restore-drill
```

For an emergency manual restore:

1. Stop API writes.
2. Preserve the current broken database state if investigation is needed.
3. Verify the selected dump and checksum with `npm run ops:backup:verify`.
4. Restore the selected dump into the approved target database.
5. Run Prisma migration deploy only if the restored dump is from an older approved schema.
6. Start the API and check `/health`, `/livez`, and `/readyz`.
7. Run sync and tier board smoke tests.

The backup scripts write `tmp/backups/prod-backup-*.md` and
`tmp/backups/prod-backup-verify-*.md`. The scripted drill writes
`tmp/restore-drills/restore-drill-*.md`. Copy only summary results, timing, and
non-sensitive identifiers into the public beta evidence ledger. Do not paste
database dumps, raw backup paths, access tokens, cookies, OAuth codes, or user
data.

## Rollback 절차

1. Prefer rolling back application code before database rollback when migrations are backward-compatible.
2. If the release included an expand/migrate/contract sequence, rollback only to a version compatible with the expanded schema.
3. If a destructive or irreversible migration was approved and applied, restore from the pre-deployment backup.
4. Re-check Google OAuth redirect, env values, `/readyz`, sync smoke, and tier board smoke after rollback.
5. Leave public community/share feature flags disabled.

## Pending hardening items

- Stateful services in `compose.prod.yml` (`postgres`, `redis`) still need a
  separate rehearsal before adding explicit `user:` or `cap_drop: [ALL]`.
  Official images may perform entrypoint ownership or permission setup that can
  break when privileges are removed without testing.
- Application services (`api`, `api-migrate`, `retention-cleanup`, `web`) run
  as non-root users in their images and drop Linux capabilities in production
  compose. Keep `read_only`, `tmpfs`, resource limits, and
  `no-new-privileges` enabled; `npm run qa:compose-hardening` verifies these
  local invariants.
- Stateful services stay writable only where their official images and volumes
  require it, but they are internal-only and resource-bounded in production
  compose. Keep Postgres and Redis CPU, memory, PID, healthcheck, and no-host-port
  invariants passing in `npm run qa:compose-hardening`.
