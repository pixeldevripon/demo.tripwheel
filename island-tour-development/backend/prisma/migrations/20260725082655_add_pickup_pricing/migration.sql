-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "pickupTotalPrice" DECIMAL(10,2),
ADD COLUMN     "pickupUnitPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "pickup_locations" ADD COLUMN     "price" DECIMAL(10,2);
