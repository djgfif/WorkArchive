ALTER TABLE "community_moderation_audit_logs"
    DROP CONSTRAINT "community_moderation_audit_logs_actorId_fkey";

ALTER TABLE "community_moderation_audit_logs"
    ALTER COLUMN "actorId" DROP NOT NULL;

ALTER TABLE "community_moderation_audit_logs"
    ADD CONSTRAINT "community_moderation_audit_logs_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
