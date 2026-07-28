-- SiteInfo.enableInstagram: nullable -> NOT NULL (default true).
--
-- As a nullable column a NULL had to be read as SOME default, and the read
-- sites disagreed: the dashboard rendered the checkbox from `?? true` while the
-- public projection hid the section on `?? false`. Worse, the dashboard only
-- PATCHes the flag when it differs from what it read, so ticking an
-- already-ticked box wrote nothing and the row stayed NULL forever.
--
-- Backfill first: an existing NULL means "never set", and the column default has
-- always been ON.
UPDATE "site_info" SET "enableInstagram" = true WHERE "enableInstagram" IS NULL;

ALTER TABLE "site_info" ALTER COLUMN "enableInstagram" SET NOT NULL;
ALTER TABLE "site_info" ALTER COLUMN "enableInstagram" SET DEFAULT true;
