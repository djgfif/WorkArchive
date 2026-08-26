-- Separate the approved short-reflection surface from the expanded board
-- experiment. Existing rows predate this distinction, so they are classified
-- as board content instead of being exposed through the narrower surface.
CREATE TYPE "CommunityPostSurface" AS ENUM ('reflection', 'board');

ALTER TABLE "community_posts"
ADD COLUMN "surface" "CommunityPostSurface" NOT NULL DEFAULT 'board';

ALTER TABLE "community_posts"
ALTER COLUMN "surface" SET DEFAULT 'reflection';

DROP INDEX IF EXISTS "community_posts_status_createdAt_id_idx";
DROP INDEX IF EXISTS "community_posts_status_reactionCount_createdAt_id_idx";
DROP INDEX IF EXISTS "community_posts_authorId_status_createdAt_idx";
DROP INDEX IF EXISTS "community_posts_category_status_createdAt_id_idx";
DROP INDEX IF EXISTS "community_posts_catalogTitleId_status_createdAt_id_idx";

CREATE INDEX "community_posts_surface_status_createdAt_id_idx"
ON "community_posts"("surface", "status", "createdAt", "id");
CREATE INDEX "community_posts_surface_status_reactionCount_createdAt_id_idx"
ON "community_posts"("surface", "status", "reactionCount" DESC, "createdAt" DESC, "id" DESC);
CREATE INDEX "community_posts_authorId_surface_status_createdAt_idx"
ON "community_posts"("authorId", "surface", "status", "createdAt");
CREATE INDEX "community_posts_surface_category_status_createdAt_id_idx"
ON "community_posts"("surface", "category", "status", "createdAt", "id");
CREATE INDEX "community_posts_catalogTitleId_surface_status_createdAt_id_idx"
ON "community_posts"("catalogTitleId", "surface", "status", "createdAt", "id");
