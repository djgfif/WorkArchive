# Sync Scaling Plan

`apps/api/src/modules/sync/sync.service.ts` now keeps the public pull contract
but removes the legacy unpaged path for Gate 1. It is still large and should be
split only in a focused follow-up that can absorb the regression risk.

## Current Behavior

- Push idempotency uses `UserSyncAppliedMutation` keyed by
  `(userId, clientMutationId)` and replays the stored result when the same
  mutation appears again.
- Pull accepts `since`, optional encoded cursor, and optional `limit`; missing
  limits use the server default page size.
- Pull cursor encodes `entityType`, `entityId`, and `updatedAt` ordering data.
- Pull reads at most `limit + 1` rows per entity family and globally merges one
  response page.
- Remote-newer conflicts are returned when the server version is newer than the
  pushed payload version.
- Ownership checks keep private user entities under the authenticated user.

## Gate 1 Risk

Pull is bounded per entity family, but it still performs the merge inside the
large `SyncService`. Very large archives still need load-test evidence before
commercial launch.

## Required Follow-Up

- Split sync handlers by entity type without changing the API contract.
- Keep `clientMutationId` idempotency as the public contract.
- Load test large archive pull and push batches before commercial launch.
- Keep metrics low-cardinality: entity type, status, and code are allowed;
  user ID and raw entity ID are not.
