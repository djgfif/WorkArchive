CREATE TYPE "SeriesKind" AS ENUM (
    'series',
    'franchise',
    'universe',
    'arc',
    'collection'
);

CREATE TYPE "WorkSeriesRole" AS ENUM (
    'main',
    'season',
    'arc',
    'movie',
    'ova',
    'spin_off',
    'side_story'
);

CREATE TYPE "WorkContributorRole" AS ENUM (
    'author',
    'illustrator',
    'director',
    'studio',
    'publisher',
    'screenwriter',
    'original_creator',
    'artist',
    'translator',
    'platform',
    'production_company'
);

CREATE TYPE "WorkRelationType" AS ENUM (
    'original',
    'adaptation',
    'spin_off',
    'sequel',
    'prequel',
    'side_story',
    'remake',
    'compilation',
    'alternate_version',
    'same_universe',
    'season_next',
    'season_previous'
);

CREATE TABLE "user_series" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" "SeriesKind" NOT NULL DEFAULT 'series',
    "parentId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_work_series_links" (
    "id" TEXT NOT NULL,
    "userWorkId" TEXT NOT NULL,
    "userSeriesId" TEXT NOT NULL,
    "role" "WorkSeriesRole" NOT NULL DEFAULT 'main',
    "orderIndex" DOUBLE PRECISION,
    "orderLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_work_series_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_contributors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityType" "ContributorEntityType" NOT NULL DEFAULT 'person',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_contributors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_work_contributors" (
    "id" TEXT NOT NULL,
    "userWorkId" TEXT NOT NULL,
    "userContributorId" TEXT NOT NULL,
    "role" "WorkContributorRole" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_work_contributors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_work_relations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceWorkId" TEXT NOT NULL,
    "targetWorkId" TEXT NOT NULL,
    "relationType" "WorkRelationType" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_work_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_series_userId_kind_normalizedTitle_key" ON "user_series"("userId", "kind", "normalizedTitle");
CREATE INDEX "user_series_userId_updatedAt_id_idx" ON "user_series"("userId", "updatedAt", "id");
CREATE INDEX "user_series_userId_deletedAt_idx" ON "user_series"("userId", "deletedAt");
CREATE INDEX "user_series_parentId_idx" ON "user_series"("parentId");

CREATE UNIQUE INDEX "user_work_series_links_userWorkId_userSeriesId_role_key" ON "user_work_series_links"("userWorkId", "userSeriesId", "role");
CREATE INDEX "user_work_series_links_userSeriesId_role_idx" ON "user_work_series_links"("userSeriesId", "role");
CREATE INDEX "user_work_series_links_updatedAt_id_idx" ON "user_work_series_links"("updatedAt", "id");

CREATE UNIQUE INDEX "user_contributors_userId_entityType_normalizedName_key" ON "user_contributors"("userId", "entityType", "normalizedName");
CREATE INDEX "user_contributors_userId_updatedAt_id_idx" ON "user_contributors"("userId", "updatedAt", "id");
CREATE INDEX "user_contributors_userId_deletedAt_idx" ON "user_contributors"("userId", "deletedAt");

CREATE UNIQUE INDEX "user_work_contributors_userWorkId_userContributorId_role_key" ON "user_work_contributors"("userWorkId", "userContributorId", "role");
CREATE INDEX "user_work_contributors_userContributorId_role_idx" ON "user_work_contributors"("userContributorId", "role");
CREATE INDEX "user_work_contributors_updatedAt_id_idx" ON "user_work_contributors"("updatedAt", "id");

CREATE UNIQUE INDEX "user_work_relations_sourceWorkId_targetWorkId_relationType_key" ON "user_work_relations"("sourceWorkId", "targetWorkId", "relationType");
CREATE INDEX "user_work_relations_userId_updatedAt_id_idx" ON "user_work_relations"("userId", "updatedAt", "id");
CREATE INDEX "user_work_relations_targetWorkId_relationType_idx" ON "user_work_relations"("targetWorkId", "relationType");

ALTER TABLE "user_series" ADD CONSTRAINT "user_series_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_series" ADD CONSTRAINT "user_series_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "user_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_work_series_links" ADD CONSTRAINT "user_work_series_links_userWorkId_fkey" FOREIGN KEY ("userWorkId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_work_series_links" ADD CONSTRAINT "user_work_series_links_userSeriesId_fkey" FOREIGN KEY ("userSeriesId") REFERENCES "user_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_contributors" ADD CONSTRAINT "user_contributors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_work_contributors" ADD CONSTRAINT "user_work_contributors_userWorkId_fkey" FOREIGN KEY ("userWorkId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_work_contributors" ADD CONSTRAINT "user_work_contributors_userContributorId_fkey" FOREIGN KEY ("userContributorId") REFERENCES "user_contributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_work_relations" ADD CONSTRAINT "user_work_relations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_work_relations" ADD CONSTRAINT "user_work_relations_sourceWorkId_fkey" FOREIGN KEY ("sourceWorkId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_work_relations" ADD CONSTRAINT "user_work_relations_targetWorkId_fkey" FOREIGN KEY ("targetWorkId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
