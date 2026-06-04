# API Boundary Guide

| Field                 | Value                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Status                | `active`                                                                                |
| Role                  | `API compatibility and domain boundary guide`                                           |
| Source of truth       | `apps/api/src/modules/*`, `docs/architecture/FEATURE_FIRST_STRUCTURE.md`, Prisma schema |
| Last verified against | `2026-06-04` expert feedback roadmap alignment and root verification                    |
| When to update        | API module boundaries, flat `Works` compatibility policy, or sync create contract change |

This guide fixes where new API behavior should live while Work Archive still
keeps the flat `Works` compatibility API.

## Boundary Defaults

Use these defaults before adding or changing an endpoint:

| Work type | Preferred module | Notes |
| --- | --- | --- |
| Catalog title identity, title aliases, releases, external refs, catalog submissions | `Catalog` | Catalog data is input assistance and metadata. It does not own private user record state. |
| User-owned work records, release records, timeline entries, personal fields | `UserRecords` | Mutations must be current-user scoped and should not infer ownership from client-provided IDs alone. |
| Provider search, candidate normalization, ranking, diagnostics, provider credentials | `Imports` | Search is assistive. Manual add and local-first save must remain available when providers fail. |
| Push, pull, idempotency, cursors, conflict results, sync payload compatibility | `Sync` | Preserve local-first semantics and the current sync schema contract. |
| Legacy flat `Work` create/read/update/delete response shape | `Works` | Compatibility façade only. Do not use as the default home for new domain behavior. |

## Compatibility Policy

- Do not remove the flat `Works` response shape until replacement clients and
  regression tests are in place.
- New domain behavior should first be evaluated for `Catalog`, `Imports`,
  `UserRecords`, or `Sync`.
- If `Works` must change, keep the change as a compatibility mapping over the
  split model rather than adding independent business rules there.
- Sync create must continue to resolve in this order:
  `catalogTitleId -> importDraft -> legacy fallback`.
- `importDraft.catalogTitle` remains optional legacy-compatible data. Missing
  catalog title details must keep the existing `payload.title` fallback.

## Review Checklist

Before approving API boundary changes, confirm:

- ownership checks are performed in the module that owns the private record;
- DTO validation remains whitelisted and rejects unsupported mutation shape;
- `Works` tests still cover flat compatibility behavior;
- `UserRecords`, `Catalog`, `Imports`, or `Sync` tests cover the new canonical
  behavior;
- docs and API client generation are updated only when public contracts change.
