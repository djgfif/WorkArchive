UPDATE "user_work_records"
SET "status" = 'dropped'
WHERE "status" = 'paused';

UPDATE "user_release_records"
SET "status" = 'dropped'
WHERE "status" = 'paused';

ALTER TABLE "user_work_records" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_release_records" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "WorkStatus" RENAME TO "WorkStatus_old";
CREATE TYPE "WorkStatus" AS ENUM ('planned', 'in_progress', 'completed', 'dropped');

ALTER TABLE "user_work_records"
ALTER COLUMN "status" TYPE "WorkStatus" USING ("status"::text::"WorkStatus");

ALTER TABLE "user_release_records"
ALTER COLUMN "status" TYPE "WorkStatus" USING ("status"::text::"WorkStatus");

ALTER TABLE "user_work_records" ALTER COLUMN "status" SET DEFAULT 'planned';
ALTER TABLE "user_release_records" ALTER COLUMN "status" SET DEFAULT 'planned';

DROP TYPE "WorkStatus_old";
