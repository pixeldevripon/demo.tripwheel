-- CreateEnum
CREATE TYPE "calendar_feed_kind" AS ENUM ('bookings', 'departures');

-- CreateTable
CREATE TABLE "calendar_feeds" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "kind" "calendar_feed_kind" NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastFetchedAt" TIMESTAMP(3),
    "fetchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "calendar_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feeds_token_key" ON "calendar_feeds"("token");

-- CreateIndex
CREATE INDEX "calendar_feeds_operatorId_idx" ON "calendar_feeds"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feeds_operatorId_kind_key" ON "calendar_feeds"("operatorId", "kind");

-- AddForeignKey
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
