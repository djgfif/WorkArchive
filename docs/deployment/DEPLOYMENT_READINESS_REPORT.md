# Deployment Readiness Report

Date: 2026-05-21

Scope: production rehearsal for the existing Work Archive architecture:
Google-only auth, local-first Dexie, syncQueue, Tier Board Maker,
readiness/liveness, sync idempotency, structured logs, Redis rate limiting, and
provider circuit breaker.

Kafka, Saga, API Gateway, Redis general cache, and distributed locks remain out
of scope.

## Automated Verification

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck --workspace @work-archive/shared-types` | Pass | Completed on 2026-05-21. |
| `npm run typecheck --workspace @work-archive/api` | Pass | Completed on 2026-05-21. |
| `npm run typecheck --workspace @work-archive/web` | Pass | Completed on 2026-05-21. |
| `npm run test --workspace @work-archive/api` | Pass | 18 suites, 153 tests. |
| `npm run test --workspace @work-archive/web` | Pass | 30 files, 207 tests. |
| `npm run build` | Pass | Vite emitted a non-blocking chunk-size warning. |
| `docker compose -f compose.prod.yml --env-file .env.prod build` | Blocked | Docker was reachable after escalation, but local `.env.prod` is intentionally absent. Create it from `PRODUCTION_ENV_CHECKLIST.md` on the target host; do not commit it. |

## Production Compose Boot

| Item | Result | Evidence |
| --- | --- | --- |
| `docker compose -f compose.prod.yml --env-file .env.prod build` | Blocked locally | `.env.prod` was not present in this workspace. |
| `docker compose -f compose.prod.yml --env-file .env.prod up -d` | Pending |  |
| `docker compose -f compose.prod.yml --env-file .env.prod ps` | Pending |  |
| `work-archive-postgres` healthy | Pending |  |
| `work-archive-redis` healthy | Pending |  |
| `work-archive-api` healthy | Pending |  |
| `work-archive-web` running | Pending |  |

## Health Results

| Endpoint | Result | Notes |
| --- | --- | --- |
| `/health` | Pending | Backward-compatible health. |
| `/livez` | Pending | Process liveness only. |
| `/readyz` | Pending | PostgreSQL and Redis readiness. |

## Google OAuth Results

| Scenario | Result | Notes |
| --- | --- | --- |
| Google Console redirect URI registered | Pending | Must match production callback exactly. |
| `/auth/login` Google button visible | Pending |  |
| `/api/auth/google/start` redirects to Google | Pending |  |
| `/api/auth/google/callback` returns to `/auth/google/complete` | Pending |  |
| refresh cookie issued securely | Pending | Check `Secure`, `HttpOnly`. |
| `/api/auth/me` succeeds | Pending |  |
| guest transfer review preserved | Pending |  |

## DB Backup And Restore

| Scenario | Result | Notes |
| --- | --- | --- |
| `pg_dump | gzip` backup created | Pending | Backup file moved off-host. |
| restore into clean rehearsal DB | Pending |  |
| `/readyz` after restore | Pending |  |
| login/session smoke after restore | Pending |  |
| sync smoke after restore | Pending |  |
| tier board smoke after restore | Pending |  |

## Sync Idempotency Smoke

| Entity | Result | Notes |
| --- | --- | --- |
| work duplicate `clientMutationId` returns `already_applied` | Pending |  |
| no duplicate work row | Pending |  |
| tier board card duplicate `clientMutationId` returns `already_applied` | Pending |  |
| no duplicate tier board card row | Pending |  |

## Tier Board Smoke

| Scenario | Result | Notes |
| --- | --- | --- |
| `/tier-boards` opens | Pending |  |
| new board created | Pending |  |
| text card added | Pending |  |
| image URL card added | Pending |  |
| uploaded image card added | Pending |  |
| work snapshot card added | Pending |  |
| pool to lane move | Pending |  |
| lane to pool move | Pending |  |
| JSON export/import | Pending |  |
| PNG export | Pending |  |
| linked WorkRecord not modified by card movement | Pending | Compare `updatedAt` and `serverVersion`. |

## Observability Review

| Log sample | Result | Notes |
| --- | --- | --- |
| requestId present | Pending |  |
| `sync.push.completed` present | Pending |  |
| `sync.push.failed` safe sample reviewed | Pending |  |
| `auth.google.failed` safe `errorCode` only | Pending |  |
| `imports.provider.failed` has no API key | Pending |  |
| `tier_board.import.failed` has no raw image data | Pending |  |
| no cookie/token/OAuth code in logs | Pending |  |

## Known Issues

- Vite may warn that some chunks are larger than 650 kB after minification. This
  is not a deployment blocker for closed beta, but code splitting should be
  revisited before public beta.
- Provider circuit breaker state is memory-local. It is acceptable for a
  single-instance beta deployment; use Redis-backed shared state before
  multi-instance API deployment.
- Sync conflict handling remains conservative. Idempotency prevents duplicate
  application but does not add automatic multi-device merge.

## Deployment Judgment

Current recommended judgment: **closed beta pending successful compose boot,
OAuth smoke, backup/restore drill, and production sync/tier-board smoke on the
target host**.

Public beta should wait until the pending production-host checks above have
actual evidence recorded.
