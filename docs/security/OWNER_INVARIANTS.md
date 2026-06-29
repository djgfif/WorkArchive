# Owner Invariants

Last reviewed: 2026-05-25.

## Current State

`UserWorkRecord.userId` is required in the Prisma schema and enforced by
`20260614001000_require_user_work_record_user_id`. Runtime service paths still
treat user-owned records as owned objects and must scope user-facing mutations
by both `id` and `userId`; the schema constraint complements but does not
replace object-level authorization.

The current mutation invariant is:

- user-facing active record mutations must include `id`, `userId`, and
  `deletedAt: null` in the mutation predicate;
- soft delete may return the just-deleted row, but the mutation predicate must
  still require the row to be active before the update;
- sync/import compatibility paths must not infer ownership from a user-supplied
  object id alone.

## Drift Guard

`npm run qa:owner-invariants` checks that:

- `UserWorkRecord.userId` remains required in `schema.prisma`;
- the required migration still sets `user_work_records."userId"` to `NOT NULL`;
- this document and ASVS coverage do not regress to describing required owner
  enforcement as future work.

## Release Gate

Before releases that touch ownership-sensitive records, run
`npm run qa:owner-invariants` with the rest of the commercial repository gates.
Keep owner-scoped mutation tests in place after schema changes; the schema
constraint complements but does not replace object-level authorization.
