-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "eurFxProvider" TEXT,
ADD COLUMN     "eurFxProviderAsOf" TIMESTAMP(3),
ADD COLUMN     "sourceBalanceAmount" DECIMAL(10,2),
ADD COLUMN     "sourceCurrency" "Currency",
ADD COLUMN     "sourceDepositAmount" DECIMAL(10,2),
ADD COLUMN     "sourceFxProvider" TEXT,
ADD COLUMN     "sourceFxProviderAsOf" TIMESTAMP(3),
ADD COLUMN     "sourceFxRateToBooking" DECIMAL(12,6),
ADD COLUMN     "sourceTotalRetail" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "baseCurrency" "Currency" NOT NULL,
    "quoteCurrency" "Currency" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAsOf" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fx_rates_baseCurrency_quoteCurrency_isActive_idx" ON "fx_rates"("baseCurrency", "quoteCurrency", "isActive");

-- CreateIndex
CREATE INDEX "fx_rates_expiresAt_idx" ON "fx_rates"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_baseCurrency_quoteCurrency_providerAsOf_provider_key" ON "fx_rates"("baseCurrency", "quoteCurrency", "providerAsOf", "provider");
