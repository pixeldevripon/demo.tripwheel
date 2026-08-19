import { Currency, Prisma } from '@prisma/client';

/**
 * FX normalization to EUR - the platform's conversion currency (master G3/rule #22).
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
  const rate =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_EUR;
  return new Prisma.Decimal(rate);
}

/**
 * Conversion rate from the given currency to EUR (EUR → 1).
 *
 * EXHAUSTIVE ON PURPOSE - do not collapse this back to
 * `currency === EUR ? 1 : usdToEurRate()`. That shape read "anything that is not
 * EUR is USD", which is true only for as long as `Currency` has exactly two
 * members. Adding a third (GBP, ANG, …) would have priced it silently at the USD
 * rate, and this number is not cosmetic: it is `commission_amount`, the value
 * Google Ads and Meta bid against (rule #22), and it is snapshotted onto the
 * booking forever (`fxRateToEur`). A wrong rate here is a wrong conversion value
 * on every ad platform and a wrong settlement, with nothing to flag it.
 *
 * The `never` assignment is the real guard: extend the enum and this stops
 * COMPILING, which is where the mistake gets caught.
 *
 * The throw is NOT the fail-closed point, and it is worth being precise about
 * that. Raw SQL cannot reach it - `currency` is a Postgres enum, so the database
 * rejects an unknown label too. The one window it covers is a half-applied
 * deploy: the migration adds the member while old pods still run the two-member
 * client. And it fires at `finalizeConfirmation`, i.e. AFTER seats are claimed
 * and money is captured, so it is a last-ditch assertion rather than a gate.
 * The real gate is upstream and much earlier: `FxRatesService.getRate` throws
 * 503 at reserve, before any money moves, and `resolvePricing` snapshots
 * `fxRateToEur` onto the booking - which is why this fallback is unreachable on
 * every booking the current code has ever created.
 *
 * Failing here is still the right trade: it leaves a detectable, replayable
 * state (`CONFIRMED` + `conversionFiredAt IS NULL`), whereas the old shape wrote
 * a permanently wrong `commission_amount` with nothing anywhere to flag it.
 */
export function eurFxRate(currency: Currency): Prisma.Decimal {
  switch (currency) {
    case Currency.EUR:
      return new Prisma.Decimal(1);
    case Currency.USD:
      return usdToEurRate();
    default: {
      const unhandled: never = currency;
      throw new Error(
        `eurFxRate: no EUR conversion rate is configured for currency ` +
          `${String(unhandled)} - refusing to guess (rule #22: this rate becomes ` +
          `the ad-platform conversion value).`,
      );
    }
  }
}

/** Convert an amount in `currency` to EUR, rounded HALF_UP to 2dp. */
export function toEur(
  amount: Prisma.Decimal,
  currency: Currency,
): Prisma.Decimal {
  return amount
    .mul(eurFxRate(currency))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
