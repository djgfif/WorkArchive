-- CreateEnum
CREATE TYPE "TierBoardLayout" AS ENUM ('classic', 'compact', 'gallery');

-- CreateEnum
CREATE TYPE "TierBoardVisibility" AS ENUM ('private', 'exported');

-- CreateEnum
CREATE TYPE "TierBoardItemSourceType" AS ENUM ('custom', 'image', 'url', 'work_ref', 'catalog_ref');

-- CreateEnum
CREATE TYPE "TierBoardAssetKind" AS ENUM ('image');

-- CreateEnum
CREATE TYPE "TierBoardAssetStorageType" AS ENUM ('local_blob', 'remote_url');

-- CreateTable
CREATE TABLE "user_tier_boards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "layout" "TierBoardLayout" NOT NULL DEFAULT 'classic',
    "visibility" "TierBoardVisibility" NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "user_tier_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tier_board_lanes" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "user_tier_board_lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tier_board_items" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "laneId" TEXT,
    "sourceType" "TierBoardItemSourceType" NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "linkedWorkId" TEXT,
    "linkedCatalogTitleId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "user_tier_board_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tier_board_assets" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "itemId" TEXT,
    "kind" "TierBoardAssetKind" NOT NULL DEFAULT 'image',
    "storageType" "TierBoardAssetStorageType" NOT NULL,
    "objectUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "user_tier_board_assets_pkey" PRIMARY KEY ("id")
);

-- Legacy work tier migration into independent board snapshots.
INSERT INTO "user_tier_boards" ("id", "userId", "title", "description", "layout", "visibility", "createdAt", "updatedAt", "syncStatus", "serverVersion")
SELECT
    CONCAT('legacy-tier-board-', "userId"),
    "userId",
    'Legacy 작품 티어보드',
    '기존 작품 티어 값을 독립 티어보드 item snapshot으로 변환했습니다.',
    'classic',
    'private',
    MIN("createdAt"),
    CURRENT_TIMESTAMP,
    'synced',
    1
FROM "user_work_records"
WHERE "tier" IS NOT NULL AND "userId" IS NOT NULL
GROUP BY "userId";

INSERT INTO "user_tier_board_lanes" ("id", "boardId", "label", "description", "color", "orderIndex", "createdAt", "updatedAt", "syncStatus", "serverVersion")
SELECT
    CONCAT('legacy-tier-board-', "userId", '-lane-', "tier"::TEXT),
    CONCAT('legacy-tier-board-', "userId"),
    "tier"::TEXT,
    '',
    CASE "tier"::TEXT
        WHEN 'S' THEN '#ef4444'
        WHEN 'A' THEN '#f97316'
        WHEN 'B' THEN '#22c55e'
        WHEN 'C' THEN '#38bdf8'
        ELSE '#94a3b8'
    END,
    CASE "tier"::TEXT
        WHEN 'S' THEN 0
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'C' THEN 3
        ELSE 4
    END,
    MIN("createdAt"),
    CURRENT_TIMESTAMP,
    'synced',
    1
FROM "user_work_records"
WHERE "tier" IS NOT NULL AND "userId" IS NOT NULL
GROUP BY "userId", "tier";

INSERT INTO "user_tier_board_items" (
    "id", "boardId", "laneId", "sourceType", "title", "subtitle", "imageUrl", "note",
    "linkedWorkId", "linkedCatalogTitleId", "orderIndex", "createdAt", "updatedAt",
    "syncStatus", "serverVersion"
)
SELECT
    CONCAT('legacy-tier-board-item-', r."id"),
    CONCAT('legacy-tier-board-', r."userId"),
    CONCAT('legacy-tier-board-', r."userId", '-lane-', r."tier"::TEXT),
    'work_ref',
    c."title",
    CONCAT_WS(' · ', c."type"::TEXT, NULLIF(c."author", ''), CASE WHEN r."rating" IS NULL THEN NULL ELSE CONCAT('★ ', r."rating"::TEXT) END),
    c."thumbnailUrl",
    COALESCE(NULLIF(r."shortReview", ''), r."review", ''),
    r."id",
    r."catalogTitleId",
    ROW_NUMBER() OVER (PARTITION BY r."userId", r."tier" ORDER BY r."updatedAt", r."id") - 1,
    r."createdAt",
    CURRENT_TIMESTAMP,
    'synced',
    1
FROM "user_work_records" r
JOIN "catalog_works" c ON c."id" = r."catalogWorkId"
WHERE r."tier" IS NOT NULL AND r."userId" IS NOT NULL;

-- Indexes
CREATE INDEX "user_tier_boards_userId_updatedAt_id_idx" ON "user_tier_boards"("userId", "updatedAt", "id");
CREATE INDEX "user_tier_boards_userId_deletedAt_idx" ON "user_tier_boards"("userId", "deletedAt");
CREATE INDEX "user_tier_board_lanes_boardId_orderIndex_idx" ON "user_tier_board_lanes"("boardId", "orderIndex");
CREATE INDEX "user_tier_board_lanes_updatedAt_id_idx" ON "user_tier_board_lanes"("updatedAt", "id");
CREATE INDEX "user_tier_board_items_boardId_laneId_orderIndex_idx" ON "user_tier_board_items"("boardId", "laneId", "orderIndex");
CREATE INDEX "user_tier_board_items_boardId_deletedAt_idx" ON "user_tier_board_items"("boardId", "deletedAt");
CREATE INDEX "user_tier_board_items_linkedWorkId_deletedAt_idx" ON "user_tier_board_items"("linkedWorkId", "deletedAt");
CREATE INDEX "user_tier_board_items_updatedAt_id_idx" ON "user_tier_board_items"("updatedAt", "id");
CREATE INDEX "user_tier_board_assets_boardId_deletedAt_idx" ON "user_tier_board_assets"("boardId", "deletedAt");
CREATE INDEX "user_tier_board_assets_itemId_deletedAt_idx" ON "user_tier_board_assets"("itemId", "deletedAt");
CREATE INDEX "user_tier_board_assets_updatedAt_id_idx" ON "user_tier_board_assets"("updatedAt", "id");

-- Foreign keys
ALTER TABLE "user_tier_boards" ADD CONSTRAINT "user_tier_boards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_lanes" ADD CONSTRAINT "user_tier_board_lanes_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "user_tier_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_items" ADD CONSTRAINT "user_tier_board_items_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "user_tier_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_items" ADD CONSTRAINT "user_tier_board_items_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "user_tier_board_lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_items" ADD CONSTRAINT "user_tier_board_items_linkedWorkId_fkey" FOREIGN KEY ("linkedWorkId") REFERENCES "user_work_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_items" ADD CONSTRAINT "user_tier_board_items_linkedCatalogTitleId_fkey" FOREIGN KEY ("linkedCatalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_assets" ADD CONSTRAINT "user_tier_board_assets_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "user_tier_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_tier_board_assets" ADD CONSTRAINT "user_tier_board_assets_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "user_tier_board_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove legacy work tier column and enum.
ALTER TABLE "user_work_records" DROP COLUMN IF EXISTS "tier";
DROP TYPE IF EXISTS "WorkTier";
