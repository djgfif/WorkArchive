# Sync Auto-Merge Policy

This policy documents the current local-first sync merge behavior. It does not
enable public, community, share, or social sync surfaces.

## 2026-06-04 Expert Feedback Scope

The accepted sync improvement scope is reliability validation, not broader
automatic conflict resolution. Before adding new merge rules, keep these gates
green:

- large-archive sync load dry-run and, for release candidates, live disposable
  account sync load;
- stale pull-before-push regression coverage for both stale and fresh pull
  windows;
- manual conflict resolution regression coverage for local keep, remote apply,
  and selected-field merge;
- guest-to-account transfer review remains a deliberate selected import flow,
  not an automatic guest/account archive merge.

## Safe Auto-Merge Cases

Auto-merge is allowed only when the remote snapshot and the queued local payload
refer to the same entity and stable parent identity, and the change is not a
delete/update collision.

Current safe cases are intentionally narrow:

- Work records: scalar fields must match exactly. `genres` and `personalTags`
  may be unioned, then normalized by the existing taxonomy helper.
- Release records: work/release parent IDs and personal scalar fields must
  match exactly. The merge only refreshes server metadata and keeps the item
  queued.
- Timeline entries: parent work and entry scalar fields must match exactly.
- Graph records: entity IDs and parent/link identities must match exactly.
  Contributor and series `aliases` may be unioned.
- Tier board records: entity IDs and parent identities must match exactly.
  Board, lane, card, and asset scalar fields must match exactly.

When all queued items for an entity are safe, the client writes the merged local
record, clears retry/conflict state, stores an auto-merge snapshot, rotates the
`clientMutationId`, and leaves the item queued for another push.

## Manual-Required Cases

Manual review is required when any queued item for an entity is unsafe. The
client must not partially write or reset earlier safe queue items when a later
item is unsafe.

Manual-required cases include:

- remote delete versus local update, or local delete versus remote update;
- entity ID, parent ID, relationship endpoint, release ID, lane/card/board ID,
  or other ownership mismatch;
- overlapping scalar-field edits;
- unsupported or missing remote payloads;
- unsupported response schema versions;
- local queued changes that are still in explicit conflict state.

Pull-side conflicts mark the related queue items as
`pull_conflict_local_queue` and leave the local payloads available for manual
resolution.

## Stale Pull Before Push

Before pushing a queued item whose payload has a non-zero `serverVersion`, the
client requires a fresh successful pull. The freshness window is two minutes.

If the last successful pull is stale or missing, push first performs a pull with
the active sync lease. Push is stopped when that pull fails or produces a manual
conflict. This prevents a stale local payload from overwriting newer remote
state without first observing it.

## Automatic Sync Scheduling

On account archive activation, the initial pull completes before an existing
queue is pushed in the same tab. This preserves pull-before-push ordering even
when the queue already contains local changes at sign-in.

Queue changes that arrive while a push is running are coalesced into the same
drain loop. The loop checks again after each push and continues until no
additional push request remains.

If the browser is offline or the document is hidden, the pending push request
remains queued in memory. Focus, online, or visible events resume it when the
browser becomes available again. Conflict-marked items still require manual
review and are never included in automatic push.

Pull failures are retried automatically after the larger of the server-provided
delay and the local failure backoff. When another tab owns the database sync
lease, pull and push return a retryable incomplete result with a one-second
delay instead of reporting success. Auto-sync uses that delay to retry without
requiring another queue mutation or user event. Manual sync also treats the
busy result as incomplete rather than showing a false success.

## Client ID And Sync Lease

The client ID is generated per browser database scope and stored in local app
metadata. Lease ownership combines that client ID with the current tab session,
so a tab can coordinate push/pull work without changing sync API response
shapes.

Only one active sync lease is held per local browser database scope. A lease has
a token and expiry. Push and pull extend the lease while work is active:

- pull extends while paginating remote changes;
- push extends before upload and while processing result batches;
- stale pull-before-push uses the same active lease.

Lease extension is token-safe. A released, expired, malformed, or replaced token
cannot extend another tab's lease.

## Failed Retry Backoff

Failed queue items remain in the local queue and receive retry metadata. Retry
delay uses exponential backoff from 15 seconds up to 5 minutes. Auto-sync skips
items until `nextRetryAt` has passed. Manual-required conflicts do not use
backoff; they wait for explicit resolution.

Server-side exceptions while applying an individual push change are returned as
per-change failures with code `failed_server_error`. They are retryable, do not
create idempotency replay records, and do not stop later changes in the same
push batch from being attempted. Validation failures and conflicts keep their
more specific result codes.

Push batches are capped at 200 changes at both the DTO boundary and the service
boundary. Oversized batches fail before storage writes instead of producing
partial per-change results; clients must split larger local queues into
multiple push requests.

## Client Mutation ID Rotation

`clientMutationId` is the push idempotency key. A queue item keeps its
mutation ID for ordinary retries of the same mutation.

After auto-merge, the queued payload represents a new merged mutation. The
client rotates `clientMutationId` when resetting the item for retry so the
server does not treat the merged push as a replay of the pre-merge mutation.

## Known Limitations

- There is no base snapshot scalar merge. Scalar fields are safe only when the
  remote snapshot and local payload still match.
- The local sync lease is per browser database scope. It is not a cross-browser,
  cross-device, or server-side distributed lock.
- Live sync load testing is still required. Unit and local QA checks do not
  replace the sync load smoke.
- Expanding auto-merge to overlapping scalar edits requires a separate product
  decision and new tests for data loss, rollback, and user-visible conflict
  recovery.
