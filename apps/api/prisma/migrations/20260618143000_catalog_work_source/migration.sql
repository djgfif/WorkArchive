CREATE TYPE "CatalogWorkSource" AS ENUM ('legacy_flat', 'catalog_title_snapshot');

ALTER TABLE "catalog_works"
  ADD COLUMN "source" "CatalogWorkSource" NOT NULL DEFAULT 'legacy_flat';

UPDATE "catalog_works" AS "catalog_work"
SET "source" = 'catalog_title_snapshot'
WHERE EXISTS (
  SELECT 1
  FROM "user_work_records" AS "record"
  WHERE "record"."catalogWorkId" = "catalog_work"."id"
    AND "record"."catalogTitleId" IS NOT NULL
    AND "record"."catalogTitleId" <> "record"."catalogWorkId"
);

CREATE INDEX "catalog_works_source_updatedAt_idx"
  ON "catalog_works"("source", "updatedAt");
