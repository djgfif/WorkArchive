# ADR 0003: No Kafka, Saga, or API Gateway

## Status

Accepted

## Context

The product runs as a local-first web app, a NestJS API, PostgreSQL, and Redis rate limiting. The current risk profile is migration safety, backup/restore, sync correctness, provider failure isolation, and release discipline. Kafka, Saga orchestration, and an API Gateway would add distributed-system operations before the product has a need for them.

## Decision

Do not introduce Kafka, Saga orchestration, or an API Gateway.

The runtime remains:

- Web app with Dexie local data and `syncQueue`
- NestJS API
- PostgreSQL
- Redis for rate limiting only

## Alternatives

- Kafka event bus: rejected due to operational overhead and replay/ordering complexity.
- Saga orchestration: rejected because current workflows can remain transactional or idempotent within the existing API and sync model.
- API Gateway: rejected because there is one API service and no independent service fleet to route.

## Consequences

- Reliability work should focus on health checks, readiness, backups, migrations, and contract tests.
- Cross-resource operations must be explicitly idempotent where retry is possible.
- Any future distributed runtime proposal requires a new ADR with concrete operational justification.
