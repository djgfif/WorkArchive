CREATE TABLE "user_sync_applied_mutations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sync_applied_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_sync_applied_mutations_userId_clientMutationId_key" ON "user_sync_applied_mutations"("userId", "clientMutationId");
CREATE INDEX "user_sync_applied_mutations_userId_createdAt_idx" ON "user_sync_applied_mutations"("userId", "createdAt");
CREATE INDEX "user_sync_applied_mutations_entityType_entityId_idx" ON "user_sync_applied_mutations"("entityType", "entityId");

ALTER TABLE "user_sync_applied_mutations" ADD CONSTRAINT "user_sync_applied_mutations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
