ALTER TABLE "community_posts"
ADD COLUMN "reactionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "community_posts" AS post
SET "reactionCount" = reaction_counts.count
FROM (
  SELECT "postId", COUNT(*)::INTEGER AS count
  FROM "community_reactions"
  GROUP BY "postId"
) AS reaction_counts
WHERE post.id = reaction_counts."postId";

CREATE INDEX "community_posts_status_reactionCount_createdAt_id_idx"
ON "community_posts" ("status", "reactionCount" DESC, "createdAt" DESC, id DESC);
