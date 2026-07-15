-- DropForeignKey
ALTER TABLE "booking_unit_items" DROP CONSTRAINT "booking_unit_items_ageBandId_fkey";

-- AlterTable
ALTER TABLE "booking_unit_items" ALTER COLUMN "ageBandId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "exclusiveDeparture" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "booking_unit_items" ADD CONSTRAINT "booking_unit_items_ageBandId_fkey" FOREIGN KEY ("ageBandId") REFERENCES "tour_age_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
