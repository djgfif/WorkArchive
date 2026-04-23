CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin');

CREATE TYPE "CatalogVerificationStatus" AS ENUM (
    'draft',
    'pending',
    'verified',
    'rejected',
    'merged'
);

CREATE TYPE "CatalogTitleStatus" AS ENUM (
    'unknown',
    'upcoming',
    'ongoing',
    'completed',
    'hiatus',
    'cancelled'
);

CREATE TYPE "ContributorEntityType" AS ENUM (
    'person',
    'organization',
    'group'
);

CREATE TYPE "CatalogContributorRole" AS ENUM (
    'author',
    'illustrator',
    'director',
    'studio',
    'publisher',
    'screenwriter',
    'original_creator',
    'artist',
    'translator'
);

CREATE TYPE "CatalogRelationType" AS ENUM (
    'original',
    'adaptation',
    'spin_off',
    'sequel',
    'prequel',
    'side_story',
    'remake',
    'compilation',
    'alternate_version'
);

CREATE TYPE "CatalogSubmissionStatus" AS ENUM (
    'pending',
    'approved',
    'rejected'
);

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';

CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "originalName" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_titles" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT,
    "mediumType" "WorkType" NOT NULL DEFAULT 'other',
    "subType" TEXT,
    "canonicalTitle" TEXT NOT NULL,
    "displayTitle" TEXT NOT NULL,
    "originalTitle" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "releaseYear" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "country" TEXT,
    "status" "CatalogTitleStatus" NOT NULL DEFAULT 'unknown',
    "summary" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_titles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_releases" (
    "id" TEXT NOT NULL,
    "catalogTitleId" TEXT NOT NULL,
    "releaseType" TEXT NOT NULL DEFAULT '',
    "displayLabel" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "sequence" DOUBLE PRECISION,
    "isbn" TEXT,
    "releaseDate" TIMESTAMP(3),
    "summary" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contributors" (
    "id" TEXT NOT NULL,
    "entityType" "ContributorEntityType" NOT NULL DEFAULT 'person',
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_title_contributors" (
    "id" TEXT NOT NULL,
    "catalogTitleId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "role" "CatalogContributorRole" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "catalog_title_contributors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_relations" (
    "id" TEXT NOT NULL,
    "sourceTitleId" TEXT NOT NULL,
    "targetTitleId" TEXT NOT NULL,
    "relationType" "CatalogRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_relations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_external_refs" (
    "id" TEXT NOT NULL,
    "catalogTitleId" TEXT,
    "catalogReleaseId" TEXT,
    "franchiseId" TEXT,
    "contributorId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "rawType" TEXT NOT NULL DEFAULT '',
    "language" TEXT,
    "country" TEXT,
    "confidence" DOUBLE PRECISION,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_external_refs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_external_refs_exactly_one_target_chk" CHECK (
        (
            ("catalogTitleId" IS NOT NULL)::int +
            ("catalogReleaseId" IS NOT NULL)::int +
            ("franchiseId" IS NOT NULL)::int +
            ("contributorId" IS NOT NULL)::int
        ) = 1
    )
);

CREATE TABLE "catalog_submissions" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "CatalogSubmissionStatus" NOT NULL DEFAULT 'pending',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_work_records" ADD COLUMN "catalogTitleId" TEXT;

INSERT INTO "catalog_titles" (
    "id",
    "mediumType",
    "canonicalTitle",
    "displayTitle",
    "summary",
    "thumbnailUrl",
    "verificationStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "type",
    "title",
    "title",
    "description",
    "thumbnailUrl",
    'draft',
    "createdAt",
    "updatedAt"
FROM "catalog_works";

UPDATE "user_work_records"
SET "catalogTitleId" = "catalogWorkId"
WHERE "catalogTitleId" IS NULL;

CREATE INDEX "franchises_verificationStatus_updatedAt_idx" ON "franchises"("verificationStatus", "updatedAt");
CREATE INDEX "franchises_canonicalName_idx" ON "franchises"("canonicalName");
CREATE INDEX "catalog_titles_franchiseId_idx" ON "catalog_titles"("franchiseId");
CREATE INDEX "catalog_titles_mediumType_updatedAt_idx" ON "catalog_titles"("mediumType", "updatedAt");
CREATE INDEX "catalog_titles_verificationStatus_updatedAt_idx" ON "catalog_titles"("verificationStatus", "updatedAt");
CREATE INDEX "catalog_titles_canonicalTitle_idx" ON "catalog_titles"("canonicalTitle");
CREATE INDEX "catalog_releases_catalogTitleId_sequence_idx" ON "catalog_releases"("catalogTitleId", "sequence");
CREATE INDEX "catalog_releases_isbn_idx" ON "catalog_releases"("isbn");
CREATE INDEX "contributors_entityType_canonicalName_idx" ON "contributors"("entityType", "canonicalName");
CREATE UNIQUE INDEX "catalog_title_contributors_catalogTitleId_contributorId_role_key" ON "catalog_title_contributors"("catalogTitleId", "contributorId", "role");
CREATE INDEX "catalog_title_contributors_contributorId_role_idx" ON "catalog_title_contributors"("contributorId", "role");
CREATE UNIQUE INDEX "catalog_relations_sourceTitleId_targetTitleId_relationType_key" ON "catalog_relations"("sourceTitleId", "targetTitleId", "relationType");
CREATE INDEX "catalog_relations_targetTitleId_relationType_idx" ON "catalog_relations"("targetTitleId", "relationType");
CREATE UNIQUE INDEX "catalog_external_refs_provider_rawType_externalId_key" ON "catalog_external_refs"("provider", "rawType", "externalId");
CREATE INDEX "catalog_external_refs_catalogTitleId_idx" ON "catalog_external_refs"("catalogTitleId");
CREATE INDEX "catalog_external_refs_catalogReleaseId_idx" ON "catalog_external_refs"("catalogReleaseId");
CREATE INDEX "catalog_external_refs_franchiseId_idx" ON "catalog_external_refs"("franchiseId");
CREATE INDEX "catalog_external_refs_contributorId_idx" ON "catalog_external_refs"("contributorId");
CREATE INDEX "catalog_submissions_status_createdAt_idx" ON "catalog_submissions"("status", "createdAt");
CREATE INDEX "catalog_submissions_submitterId_createdAt_idx" ON "catalog_submissions"("submitterId", "createdAt");
CREATE INDEX "catalog_audit_logs_entityType_entityId_createdAt_idx" ON "catalog_audit_logs"("entityType", "entityId", "createdAt");
CREATE INDEX "catalog_audit_logs_actorId_createdAt_idx" ON "catalog_audit_logs"("actorId", "createdAt");
CREATE INDEX "user_work_records_catalogTitleId_idx" ON "user_work_records"("catalogTitleId");

ALTER TABLE "catalog_titles" ADD CONSTRAINT "catalog_titles_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_releases" ADD CONSTRAINT "catalog_releases_catalogTitleId_fkey" FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_title_contributors" ADD CONSTRAINT "catalog_title_contributors_catalogTitleId_fkey" FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_title_contributors" ADD CONSTRAINT "catalog_title_contributors_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "contributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_relations" ADD CONSTRAINT "catalog_relations_sourceTitleId_fkey" FOREIGN KEY ("sourceTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_relations" ADD CONSTRAINT "catalog_relations_targetTitleId_fkey" FOREIGN KEY ("targetTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_external_refs" ADD CONSTRAINT "catalog_external_refs_catalogTitleId_fkey" FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_external_refs" ADD CONSTRAINT "catalog_external_refs_catalogReleaseId_fkey" FOREIGN KEY ("catalogReleaseId") REFERENCES "catalog_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_external_refs" ADD CONSTRAINT "catalog_external_refs_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_external_refs" ADD CONSTRAINT "catalog_external_refs_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "contributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_audit_logs" ADD CONSTRAINT "catalog_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_work_records" ADD CONSTRAINT "user_work_records_catalogTitleId_fkey" FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
