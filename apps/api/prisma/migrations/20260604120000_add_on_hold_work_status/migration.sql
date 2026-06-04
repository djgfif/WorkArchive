-- Re-introduce a dedicated "보류(on_hold)" work status.
-- Mirrors 20260520143000_drop_paused_work_status in reverse: PostgreSQL cannot
-- ADD VALUE to an enum inside a transaction, so we recreate the type.

ALTER TABLE "user_work_records" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_release_records" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "WorkStatus" RENAME TO "WorkStatus_old";
CREATE TYPE "WorkStatus" AS ENUM ('planned', 'in_progress', 'on_hold', 'completed', 'dropped');

ALTER TABLE "user_work_records"
ALTER COLUMN "status" TYPE "WorkStatus" USING ("status"::text::"WorkStatus");

ALTER TABLE "user_release_records"
ALTER COLUMN "status" TYPE "WorkStatus" USING ("status"::text::"WorkStatus");

ALTER TABLE "user_work_records" ALTER COLUMN "status" SET DEFAULT 'planned';
ALTER TABLE "user_release_records" ALTER COLUMN "status" SET DEFAULT 'planned';

DROP TYPE "WorkStatus_old";
