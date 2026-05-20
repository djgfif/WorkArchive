ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "handle" TEXT;

CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

CREATE TABLE "user_auth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT '',
    "pictureUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_auth_accounts_provider_providerAccountId_key"
ON "user_auth_accounts"("provider", "providerAccountId");

CREATE INDEX "user_auth_accounts_userId_idx" ON "user_auth_accounts"("userId");

CREATE INDEX "user_auth_accounts_email_idx" ON "user_auth_accounts"("email");

ALTER TABLE "user_auth_accounts"
ADD CONSTRAINT "user_auth_accounts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
