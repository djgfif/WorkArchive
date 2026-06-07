-- Drop legacy email/password authentication artifacts.
-- Google OAuth is the only supported authentication provider. The password
-- hash columns and the password reset token table are no longer written or
-- read by application code, so they are removed to shrink the attack surface.

-- Drop the password reset token table (its FK constraint is dropped with it).
DROP TABLE "password_reset_tokens";

-- Drop the unused password / legacy refresh token hash columns from users.
ALTER TABLE "users" DROP COLUMN "passwordHash";
ALTER TABLE "users" DROP COLUMN "refreshTokenHash";
