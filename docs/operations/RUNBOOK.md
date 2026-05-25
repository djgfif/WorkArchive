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

## `/readyz` 503일 때

`/readyz` checks runtime config, PostgreSQL, Prisma migration state, and Redis
when `REDIS_URL` is configured.

1. Read the JSON response `checks` field.
2. If `config` is listed, fix the missing or invalid environment variable and restart.
3. If `postgres` is listed, follow the PostgreSQL 장애 section.
4. If `migrations` is listed, run the release/local migration job, confirm every
   migration directory in the running API image exists in `_prisma_migrations`
   with `finished_at` set, and inspect for failed rows before starting the API
   again.
5. If `redis` is listed, follow the Redis 장애 section.
6. After mitigation, re-run:
   - `curl -fsS http://localhost:18731/health`
   - `curl -fsS http://localhost:18731/livez`
   - `curl -fsS http://localhost:18731/readyz`

## Metrics and alerts

`/metrics` is disabled by default with `METRICS_ENABLED=false`. Enable it only
behind an internal network, reverse-proxy allowlist, or trusted monitoring
collector. See `docs/operations/OBSERVABILITY.md` for metric names and alert
drafts.

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
4. Classify every event by source:
   - expected legacy client or stale tab;
   - manual API/script integration;
   - likely CSRF-style or untrusted caller;
   - unknown.
5. Keep audit mode until legitimate web traffic produces zero
   `http.client_header_missing` events for one full release observation window.
6. Announce the cutoff for scripts or integrations that use bearer tokens.
7. Set `WORK_ARCHIVE_CLIENT_HEADER_GUARD=enforce` in staging first and run auth,
   works mutation, sync push, import credential, and logout smoke tests.
8. Promote enforce to production only after staging has no legitimate missing
   header events.
9. After production promotion, monitor `http.client_header_missing` and `403`
   rates. Roll back to `audit` if legitimate first-party traffic is blocked.

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
6. Release a parser or credential handling fix only after provider-specific smoke testing.

Provider network facts verified in code:

- all providers use `fetchJson` with `AbortController` timeout. Default timeout
  is 5 seconds unless the provider call passes a narrower value.
- HTTP 429 `Retry-After` is retried once only when the provider-specific
  `retryAfterMaxMs` allows it.
- repeated failures open a per-provider circuit after 3 failures for a 60 second
  cooldown.
- provider circuit state is in-memory per API process. A rolling restart resets
  it, and multiple API instances do not share it.
- KOBIS currently uses an upstream HTTP endpoint and sends the user-scoped API
  key as the `key` query parameter. Guest access remains disabled. In
  production, KOBIS is disabled unless `KOBIS_HTTP_PROVIDER_ENABLED=true` is
  explicitly set.
- Enable KOBIS only when the deployment egress path is controlled and approved
  for HTTP query-string credentials, for example through a trusted network or
  sanitizing outbound proxy. If enabled, monitor provider failures and avoid
  logging full upstream URLs because the query string contains the user key.

Redis circuit backlog:

1. Store `provider`, `consecutiveFailures`, `openedUntil`, and `reasonCode` in
   Redis with a TTL slightly longer than the open window.
2. Use atomic increment/expire for failure counts so concurrent API instances
   share the same threshold.
3. Expose circuit state in `/imports/providers` from Redis first, falling back
   to process memory only when Redis is not configured.
4. Add an operator command to clear one provider circuit without restarting API
   instances.

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

Retention env defaults:

- `RETENTION_SECURITY_EVENT_DAYS=180`
- `RETENTION_REVOKED_REFRESH_SESSION_DAYS=30`
- `RETENTION_EXPIRED_REFRESH_SESSION_DAYS=30`
- `RETENTION_USED_PASSWORD_RESET_TOKEN_DAYS=7`
- `RETENTION_EXPIRED_PASSWORD_RESET_TOKEN_DAYS=7`

Safety expectations:

- the command logs matched and deleted counts per table;
- every delete uses a cutoff predicate on `createdAt`, `revokedAt`, `expiresAt`,
  or `usedAt`;
- production delete mode refuses to run without the confirmation value above;
- first run after a release should be dry-run and reviewed before enabling
  deletion.

## Backup restore 절차

1. Stop API writes.
2. Preserve the current broken database state if investigation is needed.
3. Restore the selected dump into the target database.
4. Run Prisma migration deploy only if the restored dump is from an older approved schema.
5. Start the API and check `/health`, `/livez`, and `/readyz`.
6. Run sync and tier board smoke tests.

See `docs/operations/BACKUP_POLICY.md` for exact backup and restore commands.

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
- Application services (`api`, `api-migrate`, `retention-cleanup`, `web`) run as
  non-root users in their images and now drop Linux capabilities in compose.
  Keep `read_only`, `tmpfs`, and `no-new-privileges` enabled.
