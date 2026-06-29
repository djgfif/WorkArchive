# Stability Hardening

Work Archive beta stability work keeps the current local-first architecture:
NestJS API, PostgreSQL, Redis-backed rate limiting in production, and the Dexie
`syncQueue` on the client. It intentionally does not add Kafka, Saga, Consumer
Groups, API Gateway, distributed locks, or broad Redis caching.

## Why Not Kafka, Saga, Or API Gateway

The current reliability risk is not cross-service orchestration. It is retry
safety, transaction boundaries, health signaling, provider failure isolation,
and authorization correctness inside one product boundary. Adding Kafka, Saga,
or an API Gateway would increase operational surface area without fixing the
local-first sync failure modes that beta users will actually hit.

## Sync Idempotency

Every sync queue item carries a stable `clientMutationId`. The API stores
applied mutations in `UserSyncAppliedMutation` with a unique
`(userId, clientMutationId)` constraint.

When a push arrives:

- the server first checks the idempotency table inside the same PostgreSQL
  transaction used to apply the entity write;
- if the mutation was already applied, the API returns an applied duplicate
  result without writing the entity again;
- if the mutation is new and applies successfully, the entity write and
  idempotency record commit together;
- conflicts and validation failures are not recorded as applied mutations.

This covers the common lost-response case: the server committed successfully,
but the client did not receive the response and retries the same mutation.

## Readiness And Liveness

`/health` remains backward compatible and returns the legacy process health
shape.

`/livez` is process liveness only. It does not check PostgreSQL or Redis, so it
can stay healthy during dependency outages while the process is still running.

`/readyz` is dependency readiness. It checks:

- runtime config can be read;
- PostgreSQL responds to `SELECT 1`;
- Prisma migration state is readable, has no failed unrolled-back migration
  rows, and includes every migration directory shipped with the running API
  image;
- Redis responds to `PING` when `RATE_LIMIT_STORE=redis`.

Successful `/readyz` responses include a safe `checks` object with only check
names and `ok` values, such as `config`, `postgres`, `migrations`, and, when
configured, `redis`. Do not add DSNs, hostnames, migration SQL, or user data to
this public response.

Readiness failures return HTTP 503. Production compose healthcheck uses
`/readyz`.

## Provider Circuit Breaker

Import providers are isolated with Redis-backed runtime state when `REDIS_URL`
is configured, with memory fallback outside production:

- consecutive failures are counted per provider;
- after the threshold is reached, the provider moves to OPEN for a short
  cooldown;
- OPEN providers are skipped immediately and diagnostics include
  `reasonCode: "circuit_open"`;
- a successful provider response resets its circuit state.

Provider network controls verified in code:

- provider requests use `AbortController` with a default 5 second timeout;
- one import search runs at most 3 provider lookups concurrently, preserving
  response order while limiting upstream fan-out from a single API request;
- HTTP 429 `Retry-After` is retried once only when a provider call explicitly
  allows a small retry window;
- provider credentials are sent via provider-required headers or query
  parameters and are reduced to safe error classes before logging;
- KOBIS is the known HTTP-only provider endpoint. Its key is user-scoped,
  passed as the `key` query parameter, and must stay behind the production
  egress boundary documented in the runbook.

Redis-backed provider failures use one Lua script to increment the failure
counter, refresh its TTL, and write the circuit state. This keeps threshold
evaluation atomic across multiple API instances. Operators can clear one
Redis-backed provider circuit without restarting API instances with
`npm run ops:imports:clear-circuit --workspace @work-archive/api`.

## Operational Retention

The API has a dedicated retention command for append/accumulation tables:

- `security_events`: default 180 days by `RETENTION_SECURITY_EVENT_DAYS`;
- `user_refresh_sessions`: revoked and expired sessions default 30 days by
  `RETENTION_REVOKED_REFRESH_SESSION_DAYS` and
  `RETENTION_EXPIRED_REFRESH_SESSION_DAYS`;
- `user_sync_applied_mutations`: deleted by each row's `expiresAt`;
- `notion_pull_preview_snapshots`: deleted by each row's `expiresAt`.

`npm run ops:retention:cleanup --workspace @work-archive/api` dry-runs by
default. Production delete mode requires
`RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data`.

## Rate Limits

Rate limiting uses a global `/api` bucket plus endpoint-family buckets:

- every `/api` route first passes the global bucket controlled by
  `API_GLOBAL_RATE_LIMIT_MAX`;
- auth endpoints use the auth bucket;
- sync push/pull use the sync bucket;
- provider search/import endpoints use import buckets;
- provider search separates guest and authenticated buckets when an
  Authorization header is present.

Every rate limit rejection records a `SecurityAudit` event with
`eventType: "http.rate_limit_exceeded"` and the limiter name. When metrics are
enabled, the same rejection increments `work_archive_rate_limit_exceeded_total`
with the bounded `limiter` label.

## HTTP Server Runtime Limits

The API applies Node HTTP server timeouts at bootstrap:

- `API_REQUEST_TIMEOUT_MS`: default 120000 ms, production maximum 120000 ms;
- `API_HEADERS_TIMEOUT_MS`: default 15000 ms, production maximum 30000 ms;
- `API_KEEP_ALIVE_TIMEOUT_MS`: default 5000 ms, production maximum 15000 ms.

Startup rejects invalid ordering: header timeout must not exceed request
timeout, and keep-alive timeout must be lower than header timeout. These limits
sit below endpoint rate limits and body limits to reduce slow-open request and
idle socket pressure before application handlers run.

## Structured Log Redaction

Structured event logs include consistent fields such as `event`, `requestId`,
`userId`, `durationMs`, `count`, `entityType`, `provider`, and `errorCode`.

Logs must never include:

- `Authorization` headers;
- cookies or `Set-Cookie`;
- refresh tokens or access tokens;
- OAuth authorization codes;
- provider API keys;
- raw image data or data URLs.

Error details are reduced to safe error codes or error names before logging.

## Current Limits And TODO

- Provider circuit/cache state is Redis-backed when `REDIS_URL` is configured
  and falls back to process-local memory only when Redis is absent.
- Sync conflict resolution remains conservative. Idempotency prevents duplicate
  application, but it does not introduce automatic multi-device merge.
- `/readyz` checks Redis only when Redis is part of the configured production
  rate-limit path.
- Local-first Dexie remains the source of immediate user writes. Server sync is
  private backup/sync, not a replacement for local persistence.

## Confirmed Vs Environment-Dependent

Confirmed in this repository:

- API/web Docker runtime definitions use non-root users.
- API startup no longer runs Prisma migration; `api-migrate` is the release job.
- API bootstrap applies bounded request, header, and keep-alive timeouts to the
  underlying Node HTTP server.
- Production compose gives Postgres and Redis explicit CPU, memory, and PID
  limits while keeping them internal-only with healthchecks.
- Retention cleanup targets only `security_events`, `user_refresh_sessions`,
  `user_sync_applied_mutations`, and `notion_pull_preview_snapshots` with
  explicit cutoff predicates.
- Provider requests have timeout handling, limited retry, Redis-backed circuit
  state in production, and process-local fallback outside production.

Environment-dependent before beta:

- Docker resource limits and read-only filesystem behavior must be tested on the
  actual host/runtime.
- Stateful Postgres and Redis `user:` or `cap_drop` hardening still needs a
  separate official-image rehearsal before changing production compose.
- PostgreSQL backup destination, encryption, and restore RTO/RPO depend on the
  selected off-host storage.
- Provider egress, especially KOBIS HTTP traffic, depends on network topology
  and policy approval.
