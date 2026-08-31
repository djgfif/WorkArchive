# ADR 0006: Community Public Plane and Additive API v2

## Status

Accepted

## Context

Work Archive is local-first: a user's IndexedDB archive remains the private
client source of truth. The implemented Community surface and the flat
`/api/works` compatibility contract previously obscured two independent
boundaries:

- which data is intentionally public; and
- whether a server record identifies a catalog title, an external candidate,
  or a manual title.

Shipping Community without formal release and data-rights contracts risks
turning private records into an implicit social profile. Replacing the flat API
in place would break old clients and queued sync payloads.

## Decision

Community is an approved, separate public plane with explicit publication.
`community-core` is the single-instance beta profile. It contains reflections,
boards, reviews, comments, public profiles, reports, and moderation.
`community-full` additionally contains follows, taste discovery, and
notifications, and remains disabled until its late beta Gate passes.

`personal-archive` remains the missing-config fallback and immediate rollback
profile. The former profile names remain deprecated aliases for one quarter
with their existing capability sets; aliases do not auto-promote.

Only content authored in the publication action and a confirmed minimum work
snapshot may cross into Community. Private record IDs, progress, private tags,
and private reflections must not be sent. Community rows participate in account
export, deletion preview, deletion execution, retention, report, hide/restore,
and takedown procedures.

Introduce additive endpoints:

- `/api/v2/catalog`
- `/api/v2/user-records`

The v2 create identity is a discriminated union:

- `catalog`: existing `catalogTitleId`;
- `external`: provider ID, external reference, and minimum title snapshot;
- `manual`: title and medium type.

v2 responses separate personal record fields from work identity and include
catalog summaries in list views. Local writes still flow through
`Dexie -> syncQueue -> push`; the HTTP API does not replace IndexedDB as the
client source of truth.

`/api/works` remains available but deprecated and PII-free usage is observed.
It may be removed only after internal consumers are zero and beta observation
shows zero use for two weeks. OpenAPI and Orval output are committed and CI
rejects generation drift.

## Consequences

- Release profile changes must gate web routes, API controllers, and runtime
  configuration together and fail closed on invalid values.
- Community outages and rollback must not block create, edit, read, or export
  in the private archive.
- Contract tests cover v1/v2 coexistence, the three v2 identities, legacy sync
  payloads, and mixed-client behavior.
- Database rollback is not required to disable Community; public rows remain
  subject to retention and user-data-rights procedures.
