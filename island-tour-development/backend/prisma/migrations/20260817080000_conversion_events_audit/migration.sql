-- CreateEnum
CREATE TYPE "ConversionPlatform" AS ENUM ('META', 'GOOGLE_ADS', 'GA4');

-- CreateEnum
CREATE TYPE "ConversionEventKind" AS ENUM ('CONVERSION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ConversionSendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "conversion_events" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "platform" "ConversionPlatform" NOT NULL,
    "kind" "ConversionEventKind" NOT NULL,
    "eventId" TEXT NOT NULL,
    "valueEur" DECIMAL(10,2),
    "status" "ConversionSendStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversion_events_bookingId_idx" ON "conversion_events"("bookingId");

-- CreateIndex
CREATE INDEX "conversion_events_platform_kind_createdAt_idx" ON "conversion_events"("platform", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
