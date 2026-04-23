CREATE TABLE "external_api_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_api_credentials_userId_provider_key" ON "external_api_credentials"("userId", "provider");

CREATE INDEX "external_api_credentials_provider_idx" ON "external_api_credentials"("provider");

ALTER TABLE "external_api_credentials" ADD CONSTRAINT "external_api_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
