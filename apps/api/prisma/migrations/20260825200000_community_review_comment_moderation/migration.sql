ALTER TYPE "CommunityModerationAction" ADD VALUE IF NOT EXISTS 'review_hidden';
ALTER TYPE "CommunityModerationAction" ADD VALUE IF NOT EXISTS 'review_restored';
ALTER TYPE "CommunityModerationAction" ADD VALUE IF NOT EXISTS 'comment_hidden';
ALTER TYPE "CommunityModerationAction" ADD VALUE IF NOT EXISTS 'comment_restored';

ALTER TABLE "community_reports"
  ALTER COLUMN "postId" DROP NOT NULL,
  ADD COLUMN "reviewId" TEXT,
  ADD COLUMN "commentId" TEXT;

ALTER TABLE "community_reports"
  ADD CONSTRAINT "community_reports_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "community_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "community_reports_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "community_reports_single_target_check"
    CHECK (num_nonnulls("postId", "reviewId", "commentId") = 1);

CREATE UNIQUE INDEX "community_reports_reviewId_reporterId_key"
  ON "community_reports"("reviewId", "reporterId");
CREATE UNIQUE INDEX "community_reports_commentId_reporterId_key"
  ON "community_reports"("commentId", "reporterId");

ALTER TABLE "community_moderation_audit_logs"
  ADD COLUMN "reviewId" TEXT,
  ADD COLUMN "commentId" TEXT;

ALTER TABLE "community_moderation_audit_logs"
  ADD CONSTRAINT "community_moderation_audit_logs_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "community_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "community_moderation_audit_logs_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "community_moderation_audit_logs_reviewId_createdAt_idx"
  ON "community_moderation_audit_logs"("reviewId", "createdAt");
CREATE INDEX "community_moderation_audit_logs_commentId_createdAt_idx"
  ON "community_moderation_audit_logs"("commentId", "createdAt");
