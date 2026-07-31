-- Generalise the single-purpose Hotels promo into RECOMMENDATIONS.
--
-- The old `hotels` / `hotel_translations` tables become `recommendations` /
-- `recommendation_translations`, gaining a source (EXTERNAL/INTERNAL), a category,
-- a placement set, and an INTERNAL entity pointer. The seeded "Palm Suite Apartment"
-- is carried over unchanged as an EXTERNAL recommendation in a seeded "Hotel"
-- category, placed on the thank-you page - so nothing changes on screen.
--
-- `hotels` had no foreign keys pointing at it, so this rename is DB-safe.

-- ── Enums ───────────────────────────────────────────────────────────────────────
CREATE TYPE "RecommendationSource" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "RecommendationRefType" AS ENUM ('TOUR', 'DESTINATION', 'COLLECTION', 'HUB');
CREATE TYPE "RecommendationPlacement" AS ENUM ('THANK_YOU_PAGE', 'CONFIRMATION_EMAIL');

-- ── Category table ──────────────────────────────────────────────────────────────
CREATE TABLE "recommendation_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recommendation_categories_slug_key"
    ON "recommendation_categories"("slug");

-- ── Rename hotels -> recommendations ─────────────────────────────────────────────
ALTER TABLE "hotels" RENAME TO "recommendations";
ALTER TABLE "recommendations" RENAME CONSTRAINT "hotels_pkey" TO "recommendations_pkey";
ALTER INDEX "hotels_isEnabled_displayOrder_id_idx"
    RENAME TO "recommendations_isEnabled_displayOrder_id_idx";

-- Column renames: bookingUrl -> linkUrl, pricePerNight -> priceAmount.
ALTER TABLE "recommendations" RENAME COLUMN "bookingUrl" TO "linkUrl";
ALTER TABLE "recommendations" RENAME COLUMN "pricePerNight" TO "priceAmount";

-- New columns.
ALTER TABLE "recommendations"
    ADD COLUMN "source" "RecommendationSource" NOT NULL DEFAULT 'EXTERNAL',
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "placements" "RecommendationPlacement"[] NOT NULL DEFAULT ARRAY[]::"RecommendationPlacement"[],
    ADD COLUMN "refType" "RecommendationRefType",
    ADD COLUMN "refId" TEXT;

ALTER TABLE "recommendations"
    ADD CONSTRAINT "recommendations_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "recommendation_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Rename hotel_translations -> recommendation_translations ─────────────────────
ALTER TABLE "hotel_translations" RENAME TO "recommendation_translations";
ALTER TABLE "recommendation_translations"
    RENAME CONSTRAINT "hotel_translations_pkey" TO "recommendation_translations_pkey";
ALTER TABLE "recommendation_translations" RENAME COLUMN "hotelId" TO "recommendationId";

ALTER INDEX "hotel_translations_hotelId_locale_key"
    RENAME TO "recommendation_translations_recommendationId_locale_key";
ALTER INDEX "hotel_translations_hotelId_locale_idx"
    RENAME TO "recommendation_translations_recommendationId_locale_idx";

ALTER TABLE "recommendation_translations"
    RENAME CONSTRAINT "hotel_translations_hotelId_fkey"
    TO "recommendation_translations_recommendationId_fkey";

-- ── Seed the "Hotel" category and file the migrated row under it ──────────────────
-- Idempotent: the category is inserted with a fixed id so a re-run is a no-op, and
-- the recommendation update is scoped to seeded EXTERNAL rows.
INSERT INTO "recommendation_categories" (
    "id", "name", "slug", "displayOrder", "isSeeded", "createdAt", "updatedAt"
) VALUES (
    'rec-cat-hotel', 'Hotels', 'hotels', 0, true, now(), now()
)
ON CONFLICT ("slug") DO NOTHING;

-- The carried-over apartment: EXTERNAL, filed under Hotels, featured on the TYP.
UPDATE "recommendations"
SET "source"     = 'EXTERNAL',
    "categoryId" = 'rec-cat-hotel',
    "placements" = ARRAY['THANK_YOU_PAGE']::"RecommendationPlacement"[]
WHERE "isSeeded" = true
  AND "categoryId" IS NULL;
