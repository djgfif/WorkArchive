-- Enforce at most one ACTIVE personal record per (userId, catalogTitleId) at the
-- database level. The service layer already rejects active duplicates, but that
-- check is not atomic: concurrent create requests (double click, retried push,
-- a sync create racing an API create) can interleave between the SELECT and the
-- INSERT and persist two rows. This partial unique index closes that race.
--
-- It is intentionally PARTIAL:
--   * `"catalogTitleId" IS NOT NULL` - records without a catalog title bridge
--     are free-form and must not collide with one another.
--   * `"deletedAt" IS NULL` - only ACTIVE records are constrained, so a user can
--     soft-delete a record and later re-add the same catalog title.
--
-- Prisma's schema language cannot express a partial unique index, so it is owned
-- by this migration rather than `@@unique` in schema.prisma. Keep the service
-- layer duplicate check for the friendly UX message; this index is the final
-- defense.
--
-- Preflight before deploying to an environment with existing data:
--   SELECT "userId", "catalogTitleId", COUNT(*)
--   FROM user_work_records
--   WHERE "catalogTitleId" IS NOT NULL AND "deletedAt" IS NULL
--   GROUP BY "userId", "catalogTitleId" HAVING COUNT(*) > 1;
-- The CREATE fails if that query returns rows; resolve the duplicates first.
CREATE UNIQUE INDEX "user_work_records_active_catalog_title_unique"
  ON "user_work_records" ("userId", "catalogTitleId")
  WHERE "catalogTitleId" IS NOT NULL AND "deletedAt" IS NULL;
