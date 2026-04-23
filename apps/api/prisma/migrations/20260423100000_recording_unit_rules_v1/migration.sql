CREATE TYPE "ProgressUnit" AS ENUM ('volume', 'episode', 'chapter');

ALTER TABLE "user_work_records"
  ADD COLUMN "progressCurrent" INTEGER,
  ADD COLUMN "progressTotal" INTEGER,
  ADD COLUMN "progressUnit" "ProgressUnit",
  ADD COLUMN "lastConsumedLabel" TEXT;

CREATE TABLE "user_release_records" (
  "id" TEXT NOT NULL,
  "userWorkRecordId" TEXT NOT NULL,
  "catalogReleaseId" TEXT NOT NULL,
  "status" "WorkStatus" NOT NULL DEFAULT 'planned',
  "rating" DOUBLE PRECISION,
  "shortReview" TEXT NOT NULL DEFAULT '',
  "review" TEXT NOT NULL DEFAULT '',
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
  "serverVersion" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "user_release_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_release_records_userWorkRecordId_catalogReleaseId_key"
  ON "user_release_records"("userWorkRecordId", "catalogReleaseId");

CREATE INDEX "user_release_records_userWorkRecordId_deletedAt_idx"
  ON "user_release_records"("userWorkRecordId", "deletedAt");

CREATE INDEX "user_release_records_catalogReleaseId_idx"
  ON "user_release_records"("catalogReleaseId");

CREATE INDEX "user_release_records_updatedAt_idx"
  ON "user_release_records"("updatedAt");

ALTER TABLE "user_release_records"
  ADD CONSTRAINT "user_release_records_userWorkRecordId_fkey"
  FOREIGN KEY ("userWorkRecordId") REFERENCES "user_work_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_release_records"
  ADD CONSTRAINT "user_release_records_catalogReleaseId_fkey"
  FOREIGN KEY ("catalogReleaseId") REFERENCES "catalog_releases"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
