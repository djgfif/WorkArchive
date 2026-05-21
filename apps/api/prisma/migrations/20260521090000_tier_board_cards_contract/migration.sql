DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TierBoardType') THEN
    CREATE TYPE "TierBoardType" AS ENUM ('classic_tier', 'ranking', 'freeform');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TierBoardVisibility')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       WHERE enumtypid = '"TierBoardVisibility"'::regtype
         AND enumlabel = 'link_only'
     ) THEN
    ALTER TYPE "TierBoardVisibility" ADD VALUE 'link_only';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tier_board_lanes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tier_lanes') THEN
    ALTER TABLE "user_tier_board_lanes" RENAME TO "user_tier_lanes";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tier_board_items')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tier_board_cards') THEN
    ALTER TABLE "user_tier_board_items" RENAME TO "user_tier_board_cards";
  END IF;
END $$;

ALTER TABLE "user_tier_boards"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "boardType" "TierBoardType" NOT NULL DEFAULT 'classic_tier',
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT NOT NULL DEFAULT '';

UPDATE "user_tier_boards"
SET "slug" = lower(regexp_replace(coalesce(nullif("title", ''), "id"), '[^a-zA-Z0-9가-힣]+', '-', 'g')) || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "user_tier_boards" ALTER COLUMN "slug" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_boards' AND column_name = 'layout'
  ) THEN
    ALTER TABLE "user_tier_boards" DROP COLUMN "layout";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_lanes' AND column_name = 'label'
  ) THEN
    ALTER TABLE "user_tier_lanes" RENAME COLUMN "label" TO "title";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_lanes' AND column_name = 'color'
  ) THEN
    ALTER TABLE "user_tier_lanes" RENAME COLUMN "color" TO "colorToken";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_board_cards' AND column_name = 'sourceType'
  ) THEN
    ALTER TABLE "user_tier_board_cards" RENAME COLUMN "sourceType" TO "cardSourceType";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_board_cards' AND column_name = 'linkedWorkId'
  ) THEN
    ALTER TABLE "user_tier_board_cards" RENAME COLUMN "linkedWorkId" TO "userWorkId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_board_cards' AND column_name = 'linkedCatalogTitleId'
  ) THEN
    ALTER TABLE "user_tier_board_cards" DROP COLUMN "linkedCatalogTitleId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_board_assets' AND column_name = 'itemId'
  ) THEN
    ALTER TABLE "user_tier_board_assets" RENAME COLUMN "itemId" TO "cardId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tier_board_cards' AND column_name = 'cardSourceType'
  ) THEN
    ALTER TABLE "user_tier_board_cards"
      ALTER COLUMN "cardSourceType" DROP DEFAULT,
      ALTER COLUMN "cardSourceType" TYPE TEXT
      USING "cardSourceType"::TEXT;

    UPDATE "user_tier_board_cards"
    SET "cardSourceType" = CASE "cardSourceType"
      WHEN 'image' THEN 'image_upload'
      WHEN 'url' THEN 'image_url'
      WHEN 'work_ref' THEN 'library_work'
      WHEN 'catalog_ref' THEN 'custom'
      ELSE "cardSourceType"
    END;

    DROP TYPE IF EXISTS "TierBoardCardSourceType";
    DROP TYPE IF EXISTS "TierBoardItemSourceType";
  END IF;

  CREATE TYPE "TierBoardCardSourceType" AS ENUM ('custom', 'image_upload', 'image_url', 'library_work');

  ALTER TABLE "user_tier_board_cards"
    ALTER COLUMN "cardSourceType" TYPE "TierBoardCardSourceType"
    USING "cardSourceType"::"TierBoardCardSourceType",
    ALTER COLUMN "cardSourceType" SET DEFAULT 'custom';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_tier_boards_userId_slug_key"
  ON "user_tier_boards"("userId", "slug");
CREATE INDEX IF NOT EXISTS "user_tier_lanes_boardId_orderIndex_idx"
  ON "user_tier_lanes"("boardId", "orderIndex");
CREATE INDEX IF NOT EXISTS "user_tier_lanes_updatedAt_id_idx"
  ON "user_tier_lanes"("updatedAt", "id");
CREATE INDEX IF NOT EXISTS "user_tier_board_cards_boardId_laneId_orderIndex_idx"
  ON "user_tier_board_cards"("boardId", "laneId", "orderIndex");
CREATE INDEX IF NOT EXISTS "user_tier_board_cards_boardId_deletedAt_idx"
  ON "user_tier_board_cards"("boardId", "deletedAt");
CREATE INDEX IF NOT EXISTS "user_tier_board_cards_userWorkId_deletedAt_idx"
  ON "user_tier_board_cards"("userWorkId", "deletedAt");
CREATE INDEX IF NOT EXISTS "user_tier_board_cards_updatedAt_id_idx"
  ON "user_tier_board_cards"("updatedAt", "id");
CREATE INDEX IF NOT EXISTS "user_tier_board_assets_cardId_deletedAt_idx"
  ON "user_tier_board_assets"("cardId", "deletedAt");
