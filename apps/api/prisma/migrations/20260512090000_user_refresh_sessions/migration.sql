-- Existing single-column refresh sessions cannot be mapped back to a device
-- session safely, so this migration forces users to sign in again.
UPDATE "users"
SET "refreshTokenHash" = NULL
WHERE "refreshTokenHash" IS NOT NULL;

CREATE TABLE "user_refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_refresh_sessions_userId_revokedAt_idx"
ON "user_refresh_sessions"("userId", "revokedAt");

CREATE INDEX "user_refresh_sessions_expiresAt_idx"
ON "user_refresh_sessions"("expiresAt");

ALTER TABLE "user_refresh_sessions"
ADD CONSTRAINT "user_refresh_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
