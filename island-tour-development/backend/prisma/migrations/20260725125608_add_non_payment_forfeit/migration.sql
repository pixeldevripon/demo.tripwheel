-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "utcForfeitedAt" TIMESTAMP(3),
ADD COLUMN     "utcNonPaymentReportedAt" TIMESTAMP(3);
