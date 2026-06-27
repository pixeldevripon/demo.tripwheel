-- AlterEnum
BEGIN;
CREATE TYPE "FeatureType_new" AS ENUM ('INCLUSION', 'EXCLUSION', 'PREBOOKING_INFORMATION', 'PREARRIVAL_INFORMATION', 'REDEMPTION_INSTRUCTION', 'ACCESSIBILITY_INFORMATION', 'ADDITIONAL_INFORMATION', 'BOOKING_TERM', 'CANCELLATION_TERM');
ALTER TABLE "tour_features" ALTER COLUMN "type" TYPE "FeatureType_new" USING ("type"::text::"FeatureType_new");
ALTER TYPE "FeatureType" RENAME TO "FeatureType_old";
ALTER TYPE "FeatureType_new" RENAME TO "FeatureType";
DROP TYPE "public"."FeatureType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "tour_highlight_translations" DROP CONSTRAINT "tour_highlight_translations_highlightId_fkey";

-- DropForeignKey
ALTER TABLE "tour_highlights" DROP CONSTRAINT "tour_highlights_tourId_fkey";

-- DropTable
DROP TABLE "tour_highlight_translations";

-- DropTable
DROP TABLE "tour_highlights";

