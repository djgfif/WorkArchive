# BOLA Matrix

Last reviewed: 2026-05-25.

This matrix tracks broken object level authorization coverage for user-owned
objects. It separates current owner-scoped implementation from tests that still
need explicit matrix coverage.

Status values:

- `satisfied`: owner scope exists and a focused test currently covers it.
- `partial`: owner scope exists, but matrix-specific coverage is incomplete.
- `gap`: missing or not yet proven.

## Object Ownership Matrix

| Object family | Read | Update | Delete | Sync push | Sync pull | Current owner-scoped implementation | Test status / remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `work` | satisfied | satisfied | satisfied | satisfied | satisfied | `WorksService.findAll/findOne` call `UserRecordsService.findActiveByUser*`; mutations use `updateActiveForUser(userId, id, deletedAt: null)`; `SyncService.applyChange` rejects `existing.userId !== userId`; pull uses `findByUserSince(userId)`. | `apps/api/test/works.service.spec.ts` rejects missing or foreign update/delete; `apps/api/test/user-records.service.spec.ts` asserts owner-scoped `updateMany`; `apps/api/test/sync.service.spec.ts` rejects foreign work sync push. |
| `release_record` | partial | partial | partial | partial | satisfied | User-facing release view first loads the parent work by current user; sync update rejects when `existing.userWorkRecord.userId !== userId`; create validates parent work and catalog release title; pull uses `releaseRecordsService.findByUserSince(userId)`. | Add matrix unit cases for foreign existing release record and foreign parent create. |
| `timeline_entry` | partial | partial | partial | partial | satisfied | Sync update rejects `existing.userId !== userId`; create validates parent work belongs to user; pull uses `timelineEntriesService.findByUserSince(userId)`. | Add matrix unit cases for foreign existing timeline entry and foreign parent create. |
| `series` | partial | partial | partial | partial | satisfied | Sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; parent series lookup includes `userId`; pull queries `userSeries` by `userId`. | Add matrix tests for foreign existing series and foreign parent series. |
| `contributor` | partial | partial | partial | partial | satisfied | Sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; pull queries `userContributor` by `userId`. | Add matrix test for foreign existing contributor. |
| `relation` (`work_series_link`, `work_contributor`, `work_relation`) | partial | partial | partial | partial | satisfied | Sync update checks both link parents belong to current user; create validators load parent work/series/contributor/relation endpoints by `userId`; pull queries links through owned parents. | Add matrix tests for each foreign parent combination; prioritize `work_relation` source/target mismatch. |
| `tier_board` | partial | partial | partial | partial | satisfied | Sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; delete tombstones only the addressed board; pull queries board by `userId`. | Add matrix test for foreign existing tier board. |
| `tier_board` children (`tier_lane`, `tier_board_card`, `tier_board_asset`) | partial | partial | partial | partial | satisfied | Sync validators require owned, active parent board; card and asset validators require owned lane/card when present; existing child checks include `board.userId`. | Add matrix tests for foreign board, lane, card, and library work parents. |

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
   - one release record sync unit test for `existing.userWorkRecord.userId`
     mismatch;
   - one timeline entry sync unit test for `existing.userId` mismatch;
   - one tier board child sync unit test for a foreign parent board.
3. Avoid broad e2e expansion until the service matrix above has one focused
   unit test per object family.

## Release Gate

For each security release, record whether all `partial` rows above have either
a new test or an explicit risk acceptance. Do not treat read scoping as enough
for BOLA; update, delete, sync push, and sync pull must each be reasoned about.
