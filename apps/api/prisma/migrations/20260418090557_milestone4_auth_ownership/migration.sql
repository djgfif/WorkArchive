-- DropIndex
DROP INDEX "works_deletedAt_idx";

-- DropIndex
DROP INDEX "works_status_updatedAt_idx";

-- DropIndex
DROP INDEX "works_type_updatedAt_idx";

-- DropIndex
DROP INDEX "works_updatedAt_idx";

-- AlterTable
ALTER TABLE "works" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "nickname" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "works_userId_deletedAt_idx" ON "works"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "works_userId_type_updatedAt_idx" ON "works"("userId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "works_userId_status_updatedAt_idx" ON "works"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "works_userId_updatedAt_idx" ON "works"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
