DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'user_tier_board_cards'
      AND constraint_name = 'user_tier_board_cards_userWorkId_fkey'
  ) THEN
    ALTER TABLE "user_tier_board_cards"
      DROP CONSTRAINT "user_tier_board_cards_userWorkId_fkey";
  END IF;
END $$;
