CREATE TABLE "notion_pull_preview_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notionDataSourceId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "previewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notion_pull_preview_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notion_pull_preview_snapshots_userId_expiresAt_idx" ON "notion_pull_preview_snapshots"("userId", "expiresAt");
CREATE INDEX "notion_pull_preview_snapshots_expiresAt_idx" ON "notion_pull_preview_snapshots"("expiresAt");

ALTER TABLE "notion_pull_preview_snapshots" ADD CONSTRAINT "notion_pull_preview_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
