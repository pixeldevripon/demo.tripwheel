import { Currency, Prisma } from '@prisma/client';

/**
 * FX normalization to EUR — the platform's conversion currency (master G3/rule #22).
 *
 * Conversion value is always `commission_amount` in **EUR**. EUR bookings need no
 * conversion (rate = 1). USD bookings are normalized at confirmation time using a
 * configured spot rate (`FX_USD_TO_EUR`, default 0.92). The rate applied is
 * snapshotted onto the booking (`fxRateToEur`) so historical commission never drifts.
 *
 * A real-time FX provider can replace `usdToEurRate()` later without touching callers.
 */

const DEFAULT_USD_TO_EUR = 0.92;

/** Spot rate USD → EUR, from `FX_USD_TO_EUR` env or a safe default. */
export function usdToEurRate(): Prisma.Decimal {
  const raw = process.env.FX_USD_TO_EUR;
  const parsed = raw ? Number(raw) : NaN;
  const rate = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_EUR;
  return new Prisma.Decimal(rate);
}

/** Conversion rate from the given currency to EUR (EUR → 1). */
export function eurFxRate(currency: Currency): Prisma.Decimal {
  return currency === Currency.EUR ? new Prisma.Decimal(1) : usdToEurRate();
}

/** Convert an amount in `currency` to EUR, rounded HALF_UP to 2dp. */
export function toEur(amount: Prisma.Decimal, currency: Currency): Prisma.Decimal {
  return amount.mul(eurFxRate(currency)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
