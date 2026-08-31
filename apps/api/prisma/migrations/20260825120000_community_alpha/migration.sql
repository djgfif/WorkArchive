CREATE TYPE "CommunityPostStatus" AS ENUM ('published', 'hidden', 'deleted');
CREATE TYPE "CommunityReportStatus" AS ENUM ('pending', 'resolved', 'dismissed');
CREATE TYPE "CommunityReportReason" AS ENUM ('spoiler', 'harassment', 'hate', 'spam', 'other');
CREATE TYPE "CommunityModerationAction" AS ENUM ('post_hidden', 'post_restored', 'report_resolved', 'report_dismissed');

CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "workTitle" TEXT NOT NULL DEFAULT '',
    "workType" "WorkType",
    "workThumbnailUrl" TEXT NOT NULL DEFAULT '',
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_reports" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "reason" "CommunityReportReason" NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'pending',
    "moderatorNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_moderation_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "postId" TEXT,
    "reportId" TEXT,
    "action" "CommunityModerationAction" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_moderation_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_posts_status_createdAt_id_idx" ON "community_posts"("status", "createdAt", "id");
CREATE INDEX "community_posts_authorId_status_createdAt_idx" ON "community_posts"("authorId", "status", "createdAt");
CREATE UNIQUE INDEX "community_reactions_postId_userId_key" ON "community_reactions"("postId", "userId");
CREATE INDEX "community_reactions_userId_createdAt_idx" ON "community_reactions"("userId", "createdAt");
CREATE UNIQUE INDEX "community_reports_postId_reporterId_key" ON "community_reports"("postId", "reporterId");
CREATE INDEX "community_reports_status_createdAt_idx" ON "community_reports"("status", "createdAt");
CREATE INDEX "community_reports_moderatorId_resolvedAt_idx" ON "community_reports"("moderatorId", "resolvedAt");
CREATE INDEX "community_moderation_audit_logs_actorId_createdAt_idx" ON "community_moderation_audit_logs"("actorId", "createdAt");
CREATE INDEX "community_moderation_audit_logs_postId_createdAt_idx" ON "community_moderation_audit_logs"("postId", "createdAt");
CREATE INDEX "community_moderation_audit_logs_reportId_createdAt_idx" ON "community_moderation_audit_logs"("reportId", "createdAt");

ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_moderatorId_fkey"
    FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_moderation_audit_logs" ADD CONSTRAINT "community_moderation_audit_logs_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "community_moderation_audit_logs" ADD CONSTRAINT "community_moderation_audit_logs_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_moderation_audit_logs" ADD CONSTRAINT "community_moderation_audit_logs_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "community_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
