import { Currency, Prisma } from '@prisma/client';

/** A currency pair the platform converts between. */
export interface FxPair {
  from: Currency;
  to: Currency;
}

/** A rate as returned by a provider (before the service stamps fetch/expiry). */
export interface ProviderRate {
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: Prisma.Decimal;
  /** The provider's own timestamp for the rate. */
  providerAsOf: Date;
}

/**
 * A fully-resolved rate the platform uses (persisted in `fx_rates` and snapshotted
 * onto bookings). Always carries provenance so a booking's conversion is auditable.
 */
export interface FxQuote {
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: Prisma.Decimal;
  provider: string;
  providerAsOf: Date;
  fetchedAt: Date;
  expiresAt: Date;
}

/** DI token for the active FX provider (swap dev-static ⇄ Stripe/OXR without callers changing). */
export const FX_PROVIDER = Symbol('FX_PROVIDER');

/**
 * Booking/tour logic must never couple to a provider response shape - it talks only
 * to this interface. A provider fetches raw rates for the requested pairs; the service
 * validates, stamps freshness, and persists them.
 */
export interface FxProvider {
  readonly name: string;
  fetchRates(pairs: FxPair[]): Promise<ProviderRate[]>;
}
