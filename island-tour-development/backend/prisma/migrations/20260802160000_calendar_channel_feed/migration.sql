-- AlterEnum
ALTER TYPE "calendar_feed_kind" ADD VALUE 'channel';

-- DropIndex
DROP INDEX "calendar_feeds_operatorId_kind_key";

-- AlterTable
ALTER TABLE "calendar_feeds" ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT '*',
ADD COLUMN     "tourId" TEXT;

-- CreateIndex
CREATE INDEX "calendar_feeds_tourId_idx" ON "calendar_feeds"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feeds_operatorId_kind_scopeKey_key" ON "calendar_feeds"("operatorId", "kind", "scopeKey");

-- AddForeignKey
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
