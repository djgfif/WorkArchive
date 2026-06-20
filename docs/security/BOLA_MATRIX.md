# BOLA Matrix

Last reviewed: 2026-06-20.

This matrix tracks broken object level authorization coverage for user-owned
objects. It separates current owner-scoped implementation from tests that still
need explicit matrix coverage.

Status values:

- `satisfied`: owner scope exists and a focused test currently covers it.
- `partial`: owner scope exists, but matrix-specific coverage is incomplete.
- `gap`: missing or not yet proven.
- `not_exposed`: no standalone backend route accepts that object family outside
  sync.

## Object Ownership Matrix

| Object family | Read | Update | Delete | Sync push | Sync pull | Current owner-scoped implementation | Test status / remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `work` | satisfied | satisfied | satisfied | satisfied | satisfied | `WorksService.findAll/findOne` call `UserRecordsService.findActiveByUser*`; mutations use `updateActiveForUser(userId, id, deletedAt: null)`; `SyncService.applyChange` rejects `existing.userId !== userId`; pull uses `findByUserSince(userId)`. | `apps/api/test/works.service.spec.ts` rejects missing or foreign update/delete; `apps/api/test/user-records.service.spec.ts` asserts owner-scoped `updateMany`; `apps/api/test/sync.service.spec.ts` rejects foreign work sync push. |
| `release_record` | satisfied | satisfied | satisfied | satisfied | satisfied | User-facing release view first loads the parent work by current user; REST update/delete/restore first load the release record through an owned parent work record; sync update rejects when `existing.userWorkRecord.userId !== userId`; create validates parent work and catalog release title; pull uses `releaseRecordsService.findByUserSince(userId)`. | `apps/api/test/user-records.service.spec.ts` covers parent-scoped release reads; `apps/api/test/user-release-records.service.spec.ts` rejects foreign update/delete/restore before any write; `apps/api/test/sync.service.spec.ts` rejects foreign existing release-record sync push and foreign parent release-record create. |
| `timeline_entry` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Timeline entries have no standalone REST controller; sync update rejects `existing.userId !== userId`; create validates parent work belongs to user; pull uses `timelineEntriesService.findByUserSince(userId)`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing timeline-entry sync push and foreign parent timeline-entry create. |
| `series` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal series records have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; parent series lookup includes `userId`; pull queries `userSeries` by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing series and foreign parent series sync push. |
| `contributor` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal contributor records have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; pull queries `userContributor` by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing contributor sync push. |
| `relation` (`work_series_link`, `work_contributor`, `work_relation`) | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal graph links have no standalone REST controller; sync update checks both link parents belong to current user; create validators load parent work/series/contributor/relation endpoints by `userId` in the current push transaction; pull queries links through owned parents. | `apps/api/test/sync.service.spec.ts` rejects foreign parent work/series/contributor combinations and `work_relation` source/target mismatch before creating links. |
| `tier_board` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Tier boards have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; delete tombstones only the addressed board; pull queries board by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing tier board sync push before any create/update write. |
| `tier_board` children (`tier_lane`, `tier_board_card`, `tier_board_asset`) | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Tier board children have no standalone REST controller; sync validators require owned, active parent board; card and asset validators require owned lane/card when present; card library-work sources require a current-user work when `workId` is present; existing child checks include `board.userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign/deleted parent board for lanes and cards, foreign/deleted parent lane for cards, foreign/deleted parent card for assets, and foreign library-work parents for cards. |

## Current Owner-Scoped Mutations

These paths are already scoped to the authenticated user or to an owned parent:

- `apps/api/src/modules/works/works.service.ts`
  - `update(userId, id, ...)` loads an active work by `userId` before changing
    shared compatibility metadata and uses `updateActiveForUser`.
  - `remove(userId, id)` uses `updateActiveForUser` with `deletedAt: null`.
- `apps/api/src/modules/user-records/user-records.service.ts`
  - `updateActiveForUser` uses `updateMany({ id, userId, deletedAt: null })`
    before reading the result with `id` and `userId`.
  - release progress and user-record views call `getActiveRecordOrThrow`.
- `apps/api/src/modules/user-records/user-release-records.service.ts`
  - `updateForUser`, `softDeleteForUser`, and `restoreForUser` first call
    `findByIdForUser(id, userId)`, which requires the parent
    `userWorkRecord.userId`.
- `apps/api/src/modules/sync/sync.service.ts`
  - `work`, `release_record`, `timeline_entry`, personal graph, and tier board
    sync push paths reject ownership mismatch or validate owned parents.
  - sync pull uses user-scoped queries for work, release records, timeline
    entries, graph records, and tier board records.
- `apps/api/src/modules/imports/imports.service.ts`
  - provider credentials are saved, deleted, and tested by authenticated
    `userId`; search duplicate checks use current-user context.

## Minimal Test Plan

Keep BOLA tests small and close to service boundaries:

1. Existing satisfied baseline:
   - `apps/api/test/works.service.spec.ts`: foreign or missing work update and
     delete reject with `NotFoundException`.
   - `apps/api/test/user-records.service.spec.ts`: active mutation predicate
     includes `id`, `userId`, and `deletedAt: null`.
   - `apps/api/test/sync.service.spec.ts`: foreign work sync push returns
     `conflict_ownership_mismatch`.
2. Next focused additions:
   - if a future controller exposes timeline, personal graph, or tier board
     objects outside sync, add focused owner-scope tests before changing the
     row from `not_exposed`.
3. Avoid broad e2e expansion until the service matrix above has one focused
   unit test per object family.

## Release Gate

For each security release, record whether all `partial` rows above have either
a new test or an explicit risk acceptance, and verify that `not_exposed` rows
still have no standalone controller. Do not treat read scoping as enough for
BOLA; update, delete, sync push, and sync pull must each be reasoned about.
