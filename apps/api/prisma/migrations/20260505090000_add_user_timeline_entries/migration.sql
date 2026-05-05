-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('note', 'started', 'completed', 'dropped', 'rewatch', 'progress');

-- CreateTable
CREATE TABLE "user_timeline_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userWorkRecordId" TEXT NOT NULL,
    "type" "TimelineEntryType" NOT NULL DEFAULT 'note',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
    "serverVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_timeline_entries_userId_updatedAt_id_idx" ON "user_timeline_entries"("userId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "user_timeline_entries_userWorkRecordId_occurredAt_idx" ON "user_timeline_entries"("userWorkRecordId", "occurredAt");

-- CreateIndex
CREATE INDEX "user_timeline_entries_userWorkRecordId_deletedAt_idx" ON "user_timeline_entries"("userWorkRecordId", "deletedAt");

-- AddForeignKey
ALTER TABLE "user_timeline_entries" ADD CONSTRAINT "user_timeline_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_timeline_entries" ADD CONSTRAINT "user_timeline_entries_userWorkRecordId_fkey" FOREIGN KEY ("userWorkRecordId") REFERENCES "user_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
