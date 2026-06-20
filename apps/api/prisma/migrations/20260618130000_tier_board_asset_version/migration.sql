ALTER TABLE "user_tier_board_assets"
  ADD COLUMN "syncStatus" "WorkSyncStatus" NOT NULL DEFAULT 'synced',
  ADD COLUMN "serverVersion" INTEGER NOT NULL DEFAULT 1;
