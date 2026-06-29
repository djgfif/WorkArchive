# Sync Scaling Plan

`apps/api/src/modules/sync/sync.service.ts` now keeps the public sync contract
and delegates push/pull work to focused services. Entity-family handlers remain
large enough that deeper splits should happen only in focused follow-ups that
can absorb regression risk. Tier-board sync has started that path by separating
root board, lane, card, asset, and version-guard write logic into focused
modules while keeping `sync-push.tier-board-handler.ts` as the compatibility
entrypoint for the dispatcher. Graph entity sync follows the same pattern:
`sync-push.graph-entity-handler.ts` remains the dispatcher-compatible
entrypoint while series and contributor writes live in focused handlers. `npm
run qa:sync-architecture` blocks drift back to a monolithic `SyncService`,
tier-board sync handler, or graph entity sync handler.

## Current Behavior

- Push idempotency uses `UserSyncAppliedMutation` keyed by
  `(userId, clientMutationId)` and replays the stored result when the same
  mutation appears again.
- Push batches are capped at 200 changes at both the DTO boundary and the
  service boundary. Oversized batches fail before storage writes and record
  bounded sync failure metrics.
- Pull accepts `since`, optional encoded cursor, and optional `limit`; missing
  limits use the server default page size.
- Pull cursor encodes `entityType`, `entityId`, and `updatedAt` ordering data.
- Pull reads at most `limit + 1` rows per entity family and globally merges one
  response page.
- Remote-newer conflicts are returned when the server version is newer than the
  pushed payload version.
- Ownership checks keep private user entities under the authenticated user.
- Sync metrics include push/pull outcomes, push/pull duration histograms,
  conflict counts, and validation-failure counts with bounded labels.
- `npm run qa:sync-architecture` keeps the thin sync facade,
  dispatcher-compatible tier-board and graph entity entrypoints, and focused
  tier-board/series/contributor handler splits from regressing.

## Gate 1 Risk

Pull is bounded per entity family and push is bounded per request, but large
archive behavior still needs live or representative load-test evidence before
commercial launch. The
`work_archive_sync_duration_seconds` histogram lets operators compare push and
pull latency in beta traffic without recording user IDs, raw entity IDs, or
payload contents.

## Required Follow-Up

- Continue splitting the remaining large entity-family sync handlers, especially
  work, release-record, timeline-entry, and graph link handlers, without
  changing the API contract.
- Keep `clientMutationId` idempotency as the public contract.
- Load test large archive pull and push batches before commercial launch.
- Keep metrics low-cardinality: direction, result, entity type, status, and code
  are allowed; user ID, raw entity ID, request ID, route, path, and payload
  dimensions are not.
