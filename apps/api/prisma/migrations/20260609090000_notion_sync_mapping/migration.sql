CREATE TABLE "notion_sync_mappings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "notionPageId" TEXT NOT NULL,
    "notionDataSourceId" TEXT NOT NULL,
    "lastPushedAt" TIMESTAMP(3),
    "lastPulledAt" TIMESTAMP(3),
    "lastNotionEditedAt" TIMESTAMP(3),
    "lastLocalUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notion_sync_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notion_sync_mappings_userId_workId_key" ON "notion_sync_mappings"("userId", "workId");
CREATE UNIQUE INDEX "notion_sync_mappings_userId_notionPageId_key" ON "notion_sync_mappings"("userId", "notionPageId");
CREATE INDEX "notion_sync_mappings_userId_notionDataSourceId_idx" ON "notion_sync_mappings"("userId", "notionDataSourceId");
CREATE INDEX "notion_sync_mappings_workId_idx" ON "notion_sync_mappings"("workId");

ALTER TABLE "notion_sync_mappings" ADD CONSTRAINT "notion_sync_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notion_sync_mappings" ADD CONSTRAINT "notion_sync_mappings_workId_fkey" FOREIGN KEY ("workId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
