# ADR 0005: Sync Idempotency with Client Mutation ID

## Status

Accepted

## Context

The local-first client queues mutations in Dexie `syncQueue`. Network failures, retries, browser restarts, and duplicate submissions can cause the same logical mutation to be delivered more than once. The API must process retries safely without creating duplicate server-side records or applying conflicting effects.

## Decision

Use `clientMutationId` as the idempotency key for sync push operations.

- Every queued client mutation must carry a stable `clientMutationId`.
- The API must persist or recognize processed mutation IDs per authenticated user.
- Replayed mutations with the same `clientMutationId` must return a safe already-applied result.
- Payload schema version changes must preserve idempotency semantics.

## Alternatives

- Timestamp-based dedupe: rejected because clocks and retry timing are unreliable.
- Server-generated operation IDs only: rejected because the client needs stable retry identity before the first successful request.
- Best-effort duplicate handling per entity: rejected because entity-level checks are incomplete for multi-entity mutations.

## Consequences

- Sync contract tests must include duplicate push delivery.
- Migration playbooks must protect the idempotency table and indexes.
- Debug logs may include mutation IDs, but must not include sensitive payload contents.
