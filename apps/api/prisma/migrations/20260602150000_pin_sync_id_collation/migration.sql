-- Pin the id columns of the sync entity tables to the byte-ordered "C"
-- collation so the database ordering (`orderBy id asc`, `id > cursor.entityId`)
-- matches the in-memory pull page ordering, which compares ids by Unicode code
-- point. Without this, the database default collation (e.g. en_US.UTF-8) can
-- disagree with JS code-point order and silently drop records that share the
-- same updatedAt at a pull page boundary.
--
-- `SET DATA TYPE ... COLLATE "C"` rebuilds the affected indexes automatically.

ALTER TABLE "user_work_records" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_release_records" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_timeline_entries" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_series" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_work_series_links" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_contributors" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_work_contributors" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_work_relations" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_tier_boards" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_tier_lanes" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_tier_board_cards" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
ALTER TABLE "user_tier_board_assets" ALTER COLUMN "id" SET DATA TYPE TEXT COLLATE "C";
