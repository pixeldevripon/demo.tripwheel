-- Recommendation category: admin-managed CRUD table -> fixed pre-typed enum.
--
-- The category is no longer a row an admin creates; it is a fixed value from a
-- curated set of tour/travel-adjacent kinds, each with typed fields + an icon in
-- code. This converts the `categoryId` FK into a `category` enum column, backfills
-- from the old slugs, and drops the `recommendation_categories` table.

CREATE TYPE "RecommendationCategory" AS ENUM (
    'HOTEL', 'APARTMENT', 'VILLA', 'RESTAURANT', 'BAR', 'CAFE', 'CAR_RENTAL',
    'TRANSFER', 'SHOP', 'SPA', 'BEACH_CLUB', 'ATTRACTION', 'ACTIVITY',
    'NIGHTLIFE', 'OTHER'
);

ALTER TABLE "recommendations"
    ADD COLUMN "category" "RecommendationCategory" NOT NULL DEFAULT 'OTHER';

-- Backfill from the old category slug. Unmapped/uncategorised rows become OTHER.
UPDATE "recommendations" r
SET "category" = CASE c."slug"
        WHEN 'hotels' THEN 'HOTEL'::"RecommendationCategory"
        WHEN 'restaurants' THEN 'RESTAURANT'::"RecommendationCategory"
        WHEN 'car-rental' THEN 'CAR_RENTAL'::"RecommendationCategory"
        WHEN 'shops' THEN 'SHOP'::"RecommendationCategory"
        WHEN 'experiences' THEN 'ACTIVITY'::"RecommendationCategory"
        ELSE 'OTHER'::"RecommendationCategory"
    END
FROM "recommendation_categories" c
WHERE r."categoryId" = c."id";

-- Drop the FK + the old column, then the table.
ALTER TABLE "recommendations"
    DROP CONSTRAINT IF EXISTS "recommendations_categoryId_fkey";
ALTER TABLE "recommendations" DROP COLUMN "categoryId";
DROP TABLE "recommendation_categories";
