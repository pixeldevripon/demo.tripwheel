-- AlterTable
ALTER TABLE "category_page_content" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "category_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "collection_page_content" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "collection_tour_rationales" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "collection_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "destination_page_content" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "destination_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "home_page_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "hub_page_content" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "hub_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "integrations_configuration" ADD COLUMN     "geminiApiKey" TEXT,
ADD COLUMN     "geminiModel" TEXT DEFAULT '';

-- AlterTable
ALTER TABLE "page_content_sections" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "pickup_location_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_exclusion_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_feature_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_highlight_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_inclusion_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_location_translations" ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "tour_translations" ADD COLUMN     "sourceHash" TEXT;
