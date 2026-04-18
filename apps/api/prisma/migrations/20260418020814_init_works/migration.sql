-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('novel', 'anime', 'manga', 'light_novel', 'web_novel', 'webtoon', 'movie', 'drama', 'other');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('planned', 'in_progress', 'completed', 'paused', 'dropped');

-- CreateEnum
CREATE TYPE "WorkTier" AS ENUM ('S', 'A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "type" "WorkType" NOT NULL DEFAULT 'novel',
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "status" "WorkStatus" NOT NULL DEFAULT 'planned',
    "rating" DOUBLE PRECISION,
    "shortReview" TEXT NOT NULL DEFAULT '',
    "review" TEXT NOT NULL DEFAULT '',
    "tier" "WorkTier",
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "works_deletedAt_idx" ON "works"("deletedAt");

-- CreateIndex
CREATE INDEX "works_type_updatedAt_idx" ON "works"("type", "updatedAt");

-- CreateIndex
CREATE INDEX "works_status_updatedAt_idx" ON "works"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "works_updatedAt_idx" ON "works"("updatedAt");
