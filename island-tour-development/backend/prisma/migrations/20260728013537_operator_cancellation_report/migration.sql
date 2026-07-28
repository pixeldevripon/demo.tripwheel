-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "operatorCancellationReason" TEXT,
ADD COLUMN     "utcOperatorCancellationReportedAt" TIMESTAMP(3);
