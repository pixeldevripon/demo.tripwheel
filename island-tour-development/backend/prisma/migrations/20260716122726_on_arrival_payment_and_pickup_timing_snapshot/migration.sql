-- CreateEnum
CREATE TYPE "OnArrivalPayment" AS ENUM ('CARD_OR_CASH', 'CASH_ONLY');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "onArrivalPayment" "OnArrivalPayment",
ADD COLUMN     "pickupMinutesPrior" INTEGER,
ADD COLUMN     "pickupWindowEnd" TEXT,
ADD COLUMN     "pickupWindowStart" TEXT;

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "onArrivalPayment" "OnArrivalPayment" NOT NULL DEFAULT 'CARD_OR_CASH';
