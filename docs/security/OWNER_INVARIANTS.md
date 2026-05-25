# Owner Invariants

Last reviewed: 2026-05-25.

## Current State

`UserWorkRecord.userId` is currently nullable in the Prisma schema. Runtime
service paths still treat user-owned records as owned objects and must scope
user-facing mutations by both `id` and `userId`.

The current mutation invariant is:

- user-facing active record mutations must include `id`, `userId`, and
  `deletedAt: null` in the mutation predicate;
- soft delete may return the just-deleted row, but the mutation predicate must
  still require the row to be active before the update;
- sync/import compatibility paths must not infer ownership from a user-supplied
  object id alone.

## Migration Plan

Do not change the schema until production data has been checked.

1. Add a release check that counts `user_work_records` rows where `userId` is
   null and confirms whether they are legacy catalog-only compatibility rows.
2. If nullable rows exist, backfill or delete them through an explicit data
   repair script with a dry-run mode and a release note.
3. Update application tests to assume user-owned records always have `userId`.
4. Add a Prisma migration changing `UserWorkRecord.userId` to required only
   after the repair check passes in staging and production rehearsal.
5. Keep owner-scoped mutation tests in place after the schema change; the schema
   constraint complements but does not replace object-level authorization.

## Release Gate

Before making `userId` required, attach the data check output and migration
dry-run output to the release artifact. If any nullable row cannot be mapped to
a real user, stop the migration and document the cleanup decision.
