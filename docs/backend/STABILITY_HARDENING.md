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

Readiness failures return HTTP 503. Production compose healthcheck uses
`/readyz`.

## Provider Circuit Breaker

Import providers are isolated with a memory-based circuit breaker:

- consecutive failures are counted per provider;
- after the threshold is reached, the provider moves to OPEN for a short
  cooldown;
- OPEN providers are skipped immediately and diagnostics include
  `reasonCode: "circuit_open"`;
- a successful provider response resets its circuit state.

Provider network controls verified in code:

- provider requests use `AbortController` with a default 5 second timeout;
- HTTP 429 `Retry-After` is retried once only when a provider call explicitly
  allows a small retry window;
- provider credentials are sent via provider-required headers or query
  parameters and are reduced to safe error classes before logging;
- KOBIS is the known HTTP-only provider endpoint. Its key is user-scoped,
  passed as the `key` query parameter, and must stay behind the production
  egress boundary documented in the runbook.

Current limitation: circuit state is process-local memory. It is safe for
single-instance beta deployments because a failure in one provider cannot stop
fallback providers, but it does not coordinate across multiple API instances.
Redis backlog is concrete:

1. replace the process map with Redis keys per provider;
2. atomically increment consecutive failures and set cooldown TTL;
3. read `/imports/providers` circuit status from Redis;
4. add an operator command to clear a provider circuit without process restart.

## Operational Retention

The API has a dedicated retention command for append/accumulation tables:

- `security_events`: default 180 days by `RETENTION_SECURITY_EVENT_DAYS`;
- `user_refresh_sessions`: revoked and expired sessions default 30 days by
  `RETENTION_REVOKED_REFRESH_SESSION_DAYS` and
  `RETENTION_EXPIRED_REFRESH_SESSION_DAYS`;
- `password_reset_tokens`: used and expired tokens default 7 days by
  `RETENTION_USED_PASSWORD_RESET_TOKEN_DAYS` and
  `RETENTION_EXPIRED_PASSWORD_RESET_TOKEN_DAYS`.

`npm run ops:retention:cleanup --workspace @work-archive/api` dry-runs by
default. Production delete mode requires
`RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data`.

## Rate Limits

Rate limiting stays scoped by endpoint family:

- auth endpoints use the auth bucket;
- sync push/pull use the sync bucket;
- provider search/import endpoints use import buckets;
- provider search separates guest and authenticated buckets when an
  Authorization header is present.

Every rate limit rejection records a `SecurityAudit` event with
`eventType: "http.rate_limit_exceeded"` and the limiter name.

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

- Provider circuit state is process-local memory. It is safe for single-instance
  beta deployments; Redis-backed shared state is the next step for multiple API
  instances.
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
- Retention cleanup targets only `security_events`, `user_refresh_sessions`, and
  `password_reset_tokens` with explicit cutoff predicates.
- Provider requests have timeout handling, limited retry, and process-local
  circuit state.

Environment-dependent before beta:

- Docker resource limits and read-only filesystem behavior must be tested on the
  actual host/runtime.
- PostgreSQL backup destination, encryption, and restore RTO/RPO depend on the
  selected off-host storage.
- Provider egress, especially KOBIS HTTP traffic, depends on network topology
  and policy approval.
