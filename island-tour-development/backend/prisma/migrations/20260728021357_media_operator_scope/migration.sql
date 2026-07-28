-- AlterTable
ALTER TABLE "media_gallery" ADD COLUMN     "operatorId" TEXT;

-- CreateIndex
CREATE INDEX "media_gallery_operatorId_idx" ON "media_gallery"("operatorId");

-- Backfill (conflict #6 stage 2): attribute every existing row to the
-- uploader's operator context so team seats immediately share one library.
-- 1. Rows uploaded by an operator OWNER account.
UPDATE "media_gallery" m
SET "operatorId" = o."id"
FROM "operators" o
WHERE o."userId" = m."userId" AND m."operatorId" IS NULL;
-- 2. Rows uploaded by a team SEAT (any status - the asset belongs to the
--    operator's library regardless of the seat's later suspension).
UPDATE "media_gallery" m
SET "operatorId" = sm."operatorId"
FROM "staff_members" sm
WHERE sm."userId" = m."userId" AND m."operatorId" IS NULL;
