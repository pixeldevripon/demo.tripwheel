-- AlterTable
ALTER TABLE "hub_comparison_group_translations" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "hub_comparison_tour_translations" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "hub_content_sections" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "hub_our_pick_translations" ADD COLUMN     "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHash" TEXT;
