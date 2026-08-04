-- Curated platform order for island lists (hero Popular row, Explore islands,
-- selectors). 1 = launch island leads; NULL = unranked, sorts after ranked
-- rows alphabetically.
ALTER TABLE "destinations" ADD COLUMN "displayOrder" INTEGER;

-- Backfill the launch order on the seeded islands, by slug. Sets ONLY the new
-- column - no other destination content is touched, safe on a live database.
UPDATE "destinations" SET "displayOrder" = CASE "slug"
  WHEN 'curacao' THEN 1
  WHEN 'aruba' THEN 2
  WHEN 'sint-maarten' THEN 3
  WHEN 'saint-lucia' THEN 4
  WHEN 'bahamas' THEN 5
END
WHERE "slug" IN ('curacao', 'aruba', 'sint-maarten', 'saint-lucia', 'bahamas')
  AND "displayOrder" IS NULL;
