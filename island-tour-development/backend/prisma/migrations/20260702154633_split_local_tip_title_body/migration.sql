-- Split the single `localTip` into a title + body pair (LD22 / Figma:
-- a bold headline tip over a muted description). Existing single tips are
-- preserved as the title; the body starts empty.

-- AlterTable
ALTER TABLE "tour_translations" ADD COLUMN "localTipTitle" TEXT;
ALTER TABLE "tour_translations" ADD COLUMN "localTipBody" TEXT;

-- Preserve existing content: the old single tip becomes the title.
UPDATE "tour_translations" SET "localTipTitle" = "localTip" WHERE "localTip" IS NOT NULL;

-- Drop the old single column.
ALTER TABLE "tour_translations" DROP COLUMN "localTip";
