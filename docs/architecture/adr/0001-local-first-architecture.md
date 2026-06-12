# ADR 0001: Local-First Architecture

## Status

Accepted

## Context

Work Archive stores the primary user workflow in the browser first. The web app uses IndexedDB through Dexie, queues sync mutations through `syncQueue`, and reconciles authenticated data with the NestJS API backed by PostgreSQL. Redis is used for rate limiting and bounded ephemeral operational state such as OAuth flow storage, image proxy cache, and import provider cache/circuit state; it is not a durable domain data store.

The product is personal archive software. Users must be able to create, edit, export, and recover local archive data even when the API, network, or external providers are unavailable.

## Decision

Keep the local-first architecture:

- Browser local data remains the source of immediate UI continuity.
- The NestJS API remains the authenticated sync and account boundary.
- PostgreSQL remains the durable server-side system of record.
- Redis remains scoped to rate limiting and bounded ephemeral operational state,
  not durable archive or catalog data.
- Dexie `syncQueue` remains the client-side retry and offline mutation buffer.

## Alternatives

- Server-first CRUD: rejected because API downtime would block core archive usage.
- Event streaming runtime: rejected because Kafka-like infrastructure is too heavy for the current operational model.
- Full backend cache layer: rejected because it adds invalidation risk without solving the main local-first requirement.

## Consequences

- Client migration safety is as important as database migration safety.
- Sync payload contracts need explicit tests and idempotency.
- Operational runbooks must distinguish API readiness from local data availability.
- Public/community features must not be coupled to the personal archive runtime.
