-- Improve local-first sync pull/read paths without changing the domain shape.
CREATE INDEX "user_work_records_userId_updatedAt_id_idx" ON "user_work_records"("userId", "updatedAt", "id");

CREATE INDEX "user_release_records_userWorkRecordId_updatedAt_id_idx" ON "user_release_records"("userWorkRecordId", "updatedAt", "id");

CREATE INDEX "user_release_records_updatedAt_id_idx" ON "user_release_records"("updatedAt", "id");
