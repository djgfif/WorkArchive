ALTER TABLE "user_refresh_sessions"
ADD COLUMN "previousTokenHash" TEXT,
ADD COLUMN "previousRotatedAt" TIMESTAMP(3);
