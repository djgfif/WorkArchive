CREATE TYPE "CommunityBoardCategory" AS ENUM (
  'free',
  'recommendation',
  'question',
  'information',
  'spoiler'
);

CREATE TYPE "CommunityProfileVisibility" AS ENUM ('private', 'public');
CREATE TYPE "CommunityNotificationType" AS ENUM ('comment', 'reaction', 'follow');

ALTER TABLE "community_posts"
  ADD COLUMN "catalogTitleId" TEXT,
  ADD COLUMN "category" "CommunityBoardCategory" NOT NULL DEFAULT 'free',
  ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "user_community_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "visibility" "CommunityProfileVisibility" NOT NULL DEFAULT 'private',
  "bio" TEXT NOT NULL DEFAULT '',
  "favoriteGenres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "favoriteCatalogTitleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "showTasteSummary" BOOLEAN NOT NULL DEFAULT false,
  "showRatings" BOOLEAN NOT NULL DEFAULT false,
  "showReviews" BOOLEAN NOT NULL DEFAULT false,
  "showBoardPosts" BOOLEAN NOT NULL DEFAULT false,
  "showFollowers" BOOLEAN NOT NULL DEFAULT false,
  "allowFollowers" BOOLEAN NOT NULL DEFAULT true,
  "notifyInCommunity" BOOLEAN NOT NULL DEFAULT true,
  "notifyGlobalBadge" BOOLEAN NOT NULL DEFAULT false,
  "notifyBrowser" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_community_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_reviews" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "catalogTitleId" TEXT NOT NULL,
  "rating" DOUBLE PRECISION,
  "body" TEXT NOT NULL DEFAULT '',
  "spoiler" BOOLEAN NOT NULL DEFAULT false,
  "reactionCount" INTEGER NOT NULL DEFAULT 0,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "status" "CommunityPostStatus" NOT NULL DEFAULT 'published',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "hiddenAt" TIMESTAMP(3),
  CONSTRAINT "community_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_reviews_rating_check"
    CHECK ("rating" IS NULL OR ("rating" >= 0.5 AND "rating" <= 5 AND MOD("rating"::numeric * 2, 1) = 0)),
  CONSTRAINT "community_reviews_content_check"
    CHECK ("rating" IS NOT NULL OR LENGTH(BTRIM("body")) > 0)
);

CREATE TABLE "community_review_reactions" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_review_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_comments" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "postId" TEXT,
  "reviewId" TEXT,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "spoiler" BOOLEAN NOT NULL DEFAULT false,
  "reactionCount" INTEGER NOT NULL DEFAULT 0,
  "status" "CommunityPostStatus" NOT NULL DEFAULT 'published',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_comments_target_check"
    CHECK (("postId" IS NOT NULL)::integer + ("reviewId" IS NOT NULL)::integer = 1)
);

CREATE TABLE "community_comment_reactions" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_follows" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_follows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_follows_not_self_check" CHECK ("followerId" <> "followingId")
);

CREATE TABLE "community_notifications" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "CommunityNotificationType" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "community_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_community_profiles_userId_key" ON "user_community_profiles"("userId");
CREATE INDEX "user_community_profiles_visibility_updatedAt_idx" ON "user_community_profiles"("visibility", "updatedAt");
CREATE UNIQUE INDEX "community_reviews_authorId_catalogTitleId_key" ON "community_reviews"("authorId", "catalogTitleId");
CREATE INDEX "community_reviews_catalogTitleId_status_createdAt_id_idx" ON "community_reviews"("catalogTitleId", "status", "createdAt", "id");
CREATE INDEX "community_reviews_status_reactionCount_createdAt_id_idx" ON "community_reviews"("status", "reactionCount" DESC, "createdAt" DESC, "id" DESC);
CREATE INDEX "community_reviews_authorId_status_createdAt_id_idx" ON "community_reviews"("authorId", "status", "createdAt", "id");
CREATE UNIQUE INDEX "community_review_reactions_reviewId_userId_key" ON "community_review_reactions"("reviewId", "userId");
CREATE INDEX "community_review_reactions_userId_createdAt_idx" ON "community_review_reactions"("userId", "createdAt");
CREATE INDEX "community_comments_postId_status_createdAt_id_idx" ON "community_comments"("postId", "status", "createdAt", "id");
CREATE INDEX "community_comments_reviewId_status_createdAt_id_idx" ON "community_comments"("reviewId", "status", "createdAt", "id");
CREATE INDEX "community_comments_parentId_status_createdAt_id_idx" ON "community_comments"("parentId", "status", "createdAt", "id");
CREATE INDEX "community_comments_authorId_status_createdAt_id_idx" ON "community_comments"("authorId", "status", "createdAt", "id");
CREATE UNIQUE INDEX "community_comment_reactions_commentId_userId_key" ON "community_comment_reactions"("commentId", "userId");
CREATE INDEX "community_comment_reactions_userId_createdAt_idx" ON "community_comment_reactions"("userId", "createdAt");
CREATE UNIQUE INDEX "community_follows_followerId_followingId_key" ON "community_follows"("followerId", "followingId");
CREATE INDEX "community_follows_followingId_createdAt_idx" ON "community_follows"("followingId", "createdAt");
CREATE INDEX "community_notifications_recipientId_readAt_createdAt_idx" ON "community_notifications"("recipientId", "readAt", "createdAt");
CREATE INDEX "community_notifications_targetType_targetId_idx" ON "community_notifications"("targetType", "targetId");
CREATE INDEX "community_posts_category_status_createdAt_id_idx" ON "community_posts"("category", "status", "createdAt", "id");
CREATE INDEX "community_posts_catalogTitleId_status_createdAt_id_idx" ON "community_posts"("catalogTitleId", "status", "createdAt", "id");

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_catalogTitleId_fkey"
  FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_community_profiles"
  ADD CONSTRAINT "user_community_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reviews"
  ADD CONSTRAINT "community_reviews_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reviews"
  ADD CONSTRAINT "community_reviews_catalogTitleId_fkey"
  FOREIGN KEY ("catalogTitleId") REFERENCES "catalog_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_review_reactions"
  ADD CONSTRAINT "community_review_reactions_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "community_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_review_reactions"
  ADD CONSTRAINT "community_review_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "community_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comment_reactions"
  ADD CONSTRAINT "community_comment_reactions_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comment_reactions"
  ADD CONSTRAINT "community_comment_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_follows"
  ADD CONSTRAINT "community_follows_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_follows"
  ADD CONSTRAINT "community_follows_followingId_fkey"
  FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_notifications"
  ADD CONSTRAINT "community_notifications_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_notifications"
  ADD CONSTRAINT "community_notifications_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
