ALTER TABLE "user_timeline_entries"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD CONSTRAINT "user_timeline_entries_source_check"
CHECK ("source" IN ('manual', 'automatic'));
