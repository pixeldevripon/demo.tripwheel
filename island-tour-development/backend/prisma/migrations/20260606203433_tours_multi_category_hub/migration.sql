/*
  Warnings:

  - You are about to drop the column `categoryId` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `hubId` on the `trips` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_hubId_fkey";

-- DropIndex
DROP INDEX "trips_categoryId_idx";

-- DropIndex
DROP INDEX "trips_hubId_idx";

-- AlterTable
ALTER TABLE "trips" DROP COLUMN "categoryId",
DROP COLUMN "hubId";

-- CreateTable
CREATE TABLE "tour_categories" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_hubs" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,

    CONSTRAINT "tour_hubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_categories_categoryId_idx" ON "tour_categories"("categoryId");

-- CreateIndex
CREATE INDEX "tour_categories_tripId_isPrimary_idx" ON "tour_categories"("tripId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_tripId_categoryId_key" ON "tour_categories"("tripId", "categoryId");

-- CreateIndex
CREATE INDEX "tour_hubs_hubId_idx" ON "tour_hubs"("hubId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_hubs_tripId_hubId_key" ON "tour_hubs"("tripId", "hubId");

-- AddForeignKey
ALTER TABLE "tour_categories" ADD CONSTRAINT "tour_categories_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_categories" ADD CONSTRAINT "tour_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_hubs" ADD CONSTRAINT "tour_hubs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_hubs" ADD CONSTRAINT "tour_hubs_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
