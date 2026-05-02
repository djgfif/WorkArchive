ALTER TABLE "user_work_records"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "droppedAt" TIMESTAMP(3),
  ADD COLUMN "lastConsumedAt" TIMESTAMP(3);
