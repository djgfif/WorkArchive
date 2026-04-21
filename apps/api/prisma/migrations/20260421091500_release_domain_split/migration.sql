-- CreateTable
CREATE TABLE "catalog_works" (
    "id" TEXT NOT NULL,
    "type" "WorkType" NOT NULL DEFAULT 'novel',
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_work_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "catalogWorkId" TEXT NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'planned',
    "rating" DOUBLE PRECISION,
    "shortReview" TEXT NOT NULL DEFAULT '',
    "review" TEXT NOT NULL DEFAULT '',
    "tier" "WorkTier",
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_work_records_pkey" PRIMARY KEY ("id")
);

-- Backfill current flat works into separated catalog and user record tables.
-- release split-only 단계에서는 id를 그대로 재사용해 catalog/user_record 1:1 매핑을 유지한다.
INSERT INTO "catalog_works" (
    "id",
    "type",
    "title",
    "author",
    "genres",
    "description",
    "thumbnailUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "type",
    "title",
    "author",
    "genres",
    "description",
    "thumbnailUrl",
    "createdAt",
    "updatedAt"
FROM "works";

INSERT INTO "user_work_records" (
    "id",
    "userId",
    "catalogWorkId",
    "status",
    "rating",
    "shortReview",
    "review",
    "tier",
    "favorite",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncStatus",
    "serverVersion"
)
SELECT
    "id",
    "userId",
    "id",
    "status",
    "rating",
    "shortReview",
    "review",
    "tier",
    "favorite",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncStatus",
    "serverVersion"
FROM "works";

-- CreateIndex
CREATE INDEX "catalog_works_type_updatedAt_idx" ON "catalog_works"("type", "updatedAt");

-- CreateIndex
CREATE INDEX "catalog_works_updatedAt_idx" ON "catalog_works"("updatedAt");

-- CreateIndex
CREATE INDEX "user_work_records_userId_deletedAt_idx" ON "user_work_records"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "user_work_records_userId_status_updatedAt_idx" ON "user_work_records"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "user_work_records_userId_updatedAt_idx" ON "user_work_records"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "user_work_records_catalogWorkId_idx" ON "user_work_records"("catalogWorkId");

-- AddForeignKey
ALTER TABLE "user_work_records" ADD CONSTRAINT "user_work_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_records" ADD CONSTRAINT "user_work_records_catalogWorkId_fkey" FOREIGN KEY ("catalogWorkId") REFERENCES "catalog_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "works";
