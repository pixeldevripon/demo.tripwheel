-- Featured cards become PURELY PRESENTATIONAL (founder, 2026-08-04): an
-- admin-typed label + poster + optional video. No category/hub reference, no
-- destination scoping, no link. Existing rows keep their current name and
-- artwork: the title is backfilled from the referenced entity, and the poster
-- inherits the entity's hero/og image where no per-card poster was set.

ALTER TABLE "featured_experiences" ADD COLUMN "title" TEXT;

UPDATE "featured_experiences" fe
SET "title" = c."name"
FROM "categories" c
WHERE fe."entityType" = 'CATEGORY' AND c."id" = fe."entityId";

UPDATE "featured_experiences" fe
SET "title" = h."name"
FROM "hubs" h
WHERE fe."entityType" = 'HUB' AND h."id" = fe."entityId";

-- Bake the old image fallback chain (poster -> hero -> og) into the poster so
-- no existing card loses its art when the entity reference goes away.
UPDATE "featured_experiences" fe
SET "posterUrl" = COALESCE(fe."posterUrl", c."heroImage", c."ogImage")
FROM "categories" c
WHERE fe."entityType" = 'CATEGORY' AND c."id" = fe."entityId";

UPDATE "featured_experiences" fe
SET "posterUrl" = COALESCE(fe."posterUrl", h."heroImage", h."ogImage")
FROM "hubs" h
WHERE fe."entityType" = 'HUB' AND h."id" = fe."entityId";

-- A row whose target vanished has nothing to show and never resolved publicly.
DELETE FROM "featured_experiences" WHERE "title" IS NULL;

ALTER TABLE "featured_experiences" ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "featured_experiences" DROP CONSTRAINT IF EXISTS "featured_experiences_destinationId_fkey";
DROP INDEX IF EXISTS "featured_experiences_entityType_entityId_idx";
DROP INDEX IF EXISTS "featured_experiences_destinationId_idx";

ALTER TABLE "featured_experiences"
  DROP COLUMN "entityType",
  DROP COLUMN "entityId",
  DROP COLUMN "destinationId",
  DROP COLUMN "isLink";

DROP TYPE IF EXISTS "FeaturedEntityType";
