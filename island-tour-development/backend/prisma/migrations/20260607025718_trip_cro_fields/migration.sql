-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "bookingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingCountToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBookedAt" TIMESTAMP(3),
ADD COLUMN     "spotsRemaining" INTEGER;
