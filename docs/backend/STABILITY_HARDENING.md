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

TODO: move circuit state to Redis if the API runs multiple instances.

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
