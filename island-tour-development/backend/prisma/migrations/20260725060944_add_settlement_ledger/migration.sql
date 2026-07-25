-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('RECORDED', 'PAID_OUT', 'INVOICED', 'SETTLED');

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "paymentModel" "PaymentModel" NOT NULL,
    "amountCollected" DECIMAL(10,2) NOT NULL,
    "commissionOwed" DECIMAL(10,2) NOT NULL,
    "netPosition" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "operatorPayout" DECIMAL(10,2),
    "status" "SettlementStatus" NOT NULL DEFAULT 'RECORDED',
    "settledAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settlements_bookingId_key" ON "settlements"("bookingId");

-- CreateIndex
CREATE INDEX "settlements_operatorId_status_idx" ON "settlements"("operatorId", "status");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
