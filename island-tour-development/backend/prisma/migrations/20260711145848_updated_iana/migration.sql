-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "tourTimeZone" TEXT,
ADD COLUMN     "utcCancellationRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tours" ALTER COLUMN "timeZone" DROP DEFAULT;
