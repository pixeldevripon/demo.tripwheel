-- Hotels: singleton -> protected list.
--
-- The apartment promo shipped as one fixed row keyed 'default'. It becomes a
-- LIST so a second property can be added and the promoted one swapped, while the
-- original stays undeletable (`isSeeded`, the same contract as a seeded
-- destination).
--
-- The thank-you page still renders exactly ONE card: the public read serves the
-- first enabled, complete hotel by `displayOrder`. Nothing about this migration
-- changes what is on screen.

ALTER TABLE "hotel" RENAME TO "hotels";
ALTER TABLE "hotels" RENAME CONSTRAINT "hotel_pkey" TO "hotels_pkey";

-- The id stops being a fixed key, so new rows get a uuid. The existing row keeps
-- whatever it has until the re-key below.
ALTER TABLE "hotels" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "hotels"
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isSeeded" BOOLEAN NOT NULL DEFAULT false;

-- The row that was the singleton is the seeded, undeletable one.
UPDATE "hotels" SET "isSeeded" = true WHERE "id" = 'default';

-- Re-key it to a real uuid so EVERY hotel is addressed the same way. Without
-- this, the literal 'default' would have to survive as a special case in every
-- route that validates its :id as a UUID - including the shared
-- content-translation generate route. The FK below is ON UPDATE CASCADE, so the
-- translation rows follow automatically.
UPDATE "hotels" SET "id" = gen_random_uuid()::text WHERE "id" = 'default';

-- The translations table keeps its own name (`hotel_translations`), so its FK
-- constraint name stays as Prisma generates it - renaming it would put the
-- database out of step with the schema for no gain.

-- The public read's exact predicate and ordering.
CREATE INDEX "hotels_isEnabled_displayOrder_id_idx"
    ON "hotels"("isEnabled", "displayOrder", "id");
