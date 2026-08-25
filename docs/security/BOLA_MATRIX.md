# BOLA Matrix

Last reviewed: 2026-08-25 Community alpha design approval.

This matrix tracks broken object level authorization coverage for user-owned
objects. It separates current owner-scoped implementation from tests that still
need explicit matrix coverage.

Status values:

- `satisfied`: owner scope exists and a focused test currently covers it.
- `partial`: owner scope exists, but matrix-specific coverage is incomplete.
- `gap`: missing or not yet proven.
- `not_exposed`: no standalone backend route accepts that object family outside
  sync.
- `planned`: the route contract is approved but must be changed to `satisfied`
  only after focused authorization tests pass and before release.

## Object Ownership Matrix

| Object family | Read | Update | Delete | Sync push | Sync pull | Current owner-scoped implementation | Test status / remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `work` | satisfied | satisfied | satisfied | satisfied | satisfied | `WorksService.findAll/findOne` call `UserRecordsService.findActiveByUser*`; mutations use `updateActiveForUser(userId, id, deletedAt: null)`; `SyncService.applyChange` rejects `existing.userId !== userId`; pull uses `findByUserSince(userId)`. | `apps/api/test/works.service.spec.ts` rejects missing or foreign update/delete; `apps/api/test/user-records.service.spec.ts` asserts owner-scoped `updateMany`; `apps/api/test/sync.service.spec.ts` rejects foreign work sync push. |
| `user_record` | satisfied | satisfied | satisfied | satisfied | satisfied | User record REST views call `listViews`, `getViewOrThrow`, `updateViewForUser`, `updateProgressForUser`, and `createViewFromImportForUser` with the authenticated `userId`; deletion is represented through the same owner-scoped work soft-delete path; sync `work` payloads use the owner-scoped `UserWorkRecord` model. | `apps/api/test/user-records.service.spec.ts` asserts owner-scoped active mutations and rejected cross-user writes; `apps/api/test/works.e2e-spec.ts` covers user scoping and ownership protection through the REST work/user-record compatibility path. |
| `release_record` | satisfied | satisfied | satisfied | satisfied | satisfied | User-facing release view first loads the parent work by current user; REST update/delete/restore first load the release record through an owned parent work record; sync update rejects when `existing.userWorkRecord.userId !== userId`; create validates parent work and catalog release title; pull uses `releaseRecordsService.findByUserSince(userId)`. | `apps/api/test/user-records.service.spec.ts` covers parent-scoped release reads; `apps/api/test/user-release-records.service.spec.ts` rejects foreign update/delete/restore before any write; `apps/api/test/sync.service.spec.ts` rejects foreign existing release-record sync push and foreign parent release-record create. |
| `timeline_entry` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Timeline entries have no standalone REST controller; sync update rejects `existing.userId !== userId`; create validates parent work belongs to user; pull uses `timelineEntriesService.findByUserSince(userId)`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing timeline-entry sync push and foreign parent timeline-entry create. |
| `series` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal series records have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; parent series lookup includes `userId`; pull queries `userSeries` by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing series and foreign parent series sync push. |
| `contributor` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal contributor records have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; pull queries `userContributor` by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing contributor sync push. |
| `relation` (`work_series_link`, `work_contributor`, `work_relation`) | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Personal graph links have no standalone REST controller; sync update checks both link parents belong to current user; create validators load parent work/series/contributor/relation endpoints by `userId` in the current push transaction; pull queries links through owned parents. | `apps/api/test/sync.service.spec.ts` rejects foreign parent work/series/contributor combinations and `work_relation` source/target mismatch before creating links. |
| `tier_board` | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Tier boards have no standalone REST controller; sync update rejects `existing.userId !== userId`; create assigns authenticated `userId`; delete tombstones only the addressed board; pull queries board by `userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign existing tier board sync push before any create/update write. |
| `tier_board` children (`tier_lane`, `tier_board_card`, `tier_board_asset`) | not_exposed | not_exposed | not_exposed | satisfied | satisfied | Tier board children have no standalone REST controller; sync validators require owned, active parent board; card and asset validators require owned lane/card when present; card library-work sources require a current-user work when `workId` is present; existing child checks include `board.userId`. | `apps/api/test/sync.service.spec.ts` rejects foreign/deleted parent board for lanes and cards, foreign/deleted parent lane for cards, foreign/deleted parent card for assets, and foreign library-work parents for cards. |
| `import_provider_credential` | satisfied | satisfied | satisfied | not_exposed | not_exposed | Provider credential status, save, delete, and test routes require `JwtAuthGuard` and pass only the authenticated `userId`; guest import search never receives stored credential values. | `apps/api/test/imports.provider-key.e2e-spec.ts` and `apps/api/test/imports.service.spec.ts` cover user-scoped provider credential save, status, test, and delete behavior. |
| `notion_connection` | satisfied | satisfied | satisfied | not_exposed | not_exposed | Notion connection status, save, delete, test, push, preview, and apply routes require `JwtAuthGuard` and pass only the authenticated `userId`; preview snapshots are user-owned and retained by policy. | `apps/api/test/notion.service.spec.ts` covers user-scoped connection and preview/apply behavior; `npm run qa:retention-policy` verifies preview retention policy drift. |
| `catalog_submission` | satisfied | satisfied | not_exposed | not_exposed | not_exposed | Submission creation stores the authenticated submitter; `listMySubmissions` is submitter-scoped; moderator list/review paths pass `{ role, userId }` and are authorized in `CatalogService`. Catalog title reads are shared catalog metadata, not user-owned objects. | `apps/api/test/catalog.controller.spec.ts` covers current-user submission listing and moderator-only review paths. |
| `community_post` | planned | not_exposed | planned | not_exposed | not_exposed | Public reads will return published rows only; create will assign the authenticated author; delete will use both post ID and author ID; moderator hide/restore will require role authorization and an audit row. | Must become `satisfied` after focused public-filter, owner-delete, foreign-delete, and moderator authorization/audit tests pass. |
| `community_reaction` | planned | planned | planned | not_exposed | not_exposed | Reactions will be addressed only through the authenticated user's unique `(postId, userId)` row. | Must become `satisfied` after idempotent create, own delete, and cross-user isolation tests pass. |
| `community_report` | planned | planned | not_exposed | not_exposed | not_exposed | Create will assign the current reporter; list and resolution will require moderator/admin; normal public responses will not expose report data. | Must become `satisfied` after duplicate/self-report, role, visibility, and audit tests pass. |
| `community_moderation_audit` | not_exposed | not_exposed | not_exposed | not_exposed | not_exposed | Immutable audit rows will be write-only from authorized moderation service operations and have no public route. | Must retain no standalone mutation or public read route; moderation tests assert an audit row for every action. |

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
- `apps/api/src/modules/notion/notion.service.ts`
  - connection, sync preview, and sync apply operations use the authenticated
    `userId`.
- `apps/api/src/modules/catalog/catalog.service.ts`
  - catalog submissions store submitter ownership, `mine` reads are submitter
    scoped, and moderation paths require moderator authorization.

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
`npm run qa:bola-matrix` blocks missing sync entity rows, unresolved `gap` or
`partial` matrix statuses, and standalone controllers for object families marked
`not_exposed` outside sync.
