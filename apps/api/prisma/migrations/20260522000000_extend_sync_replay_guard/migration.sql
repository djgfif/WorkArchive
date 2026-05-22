ALTER TABLE "user_sync_applied_mutations"
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "resultStatus" TEXT NOT NULL DEFAULT 'applied',
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "user_sync_applied_mutations_expiresAt_idx" ON "user_sync_applied_mutations"("expiresAt");
CREATE INDEX "user_sync_applied_mutations_userId_resultStatus_createdAt_idx" ON "user_sync_applied_mutations"("userId", "resultStatus", "createdAt");
