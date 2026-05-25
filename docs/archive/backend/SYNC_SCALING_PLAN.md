# Sync Scaling Plan

`apps/api/src/modules/sync/sync.service.ts` is intentionally left as-is for Gate
1 except for metrics. It is already large and should not be split during a
readiness gate unless a focused follow-up can absorb the regression risk.

## Current Behavior

- Push idempotency uses `UserSyncAppliedMutation` keyed by
  `(userId, clientMutationId)` and replays the stored result when the same
  mutation appears again.
- Pull accepts `since`, optional encoded cursor, and optional `limit`.
- Pull cursor encodes `entityType`, `entityId`, and `updatedAt` ordering data.
- Remote-newer conflicts are returned when the server version is newer than the
  pushed payload version.
- Ownership checks keep private user entities under the authenticated user.

## Gate 1 Risk

Pull currently gathers changed records from multiple domains in application
memory, builds ordered changes, and then applies `slice(0, limit)`. This is
acceptable for closed beta but can become expensive for users with large
archives.

## Required Follow-Up

- Add DB-level pagination by `(updatedAt, id)` per entity family.
- Split sync handlers by entity type without changing the API contract.
- Keep `clientMutationId` idempotency as the public contract.
- Load test large archive pull and push batches before commercial launch.
- Keep metrics low-cardinality: entity type, status, and code are allowed;
  user ID and raw entity ID are not.
