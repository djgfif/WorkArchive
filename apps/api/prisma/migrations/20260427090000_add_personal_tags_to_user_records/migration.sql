ALTER TABLE "user_work_records"
  ADD COLUMN "personalTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
