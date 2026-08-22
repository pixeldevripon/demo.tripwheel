import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FX_PROVIDER,
  type FxPair,
  type FxProvider,
  type FxQuote,
} from './fx-provider.interface';

const DEFAULT_TTL_MINUTES = 120;
const DEFAULT_STALE_DISPLAY_HOURS = 24;
/**
 * Round a TRAVELLER-FACING retail amount to a whole currency unit, always UP.
 *
 * Conversion used to leave cents behind - a $139 tour rendered to a euro shopper
 * as "from EUR 120.71", which reads like a precision the price does not have
 * (founder, 2026-08-05). Every retail amount is now a whole number.
 *
 * CEIL, never HALF_UP: rounding a converted price DOWN would advertise and
 * charge less than the operator's own price once FX moved, so the direction is
 * a commercial rule, not a formatting preference.
 *
 * Deliberately NOT applied to operator cost (`priceNet`) or to the EUR
 * commission snapshot. Neither is shown to a traveller, and inflating them
 * would distort payout and revenue figures.
 */
export const retailWhole = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(0, Prisma.Decimal.ROUND_CEIL);

/** Identity rate never expires (same-currency, no provider). */
const IDENTITY_TTL_MS = 3_650 * 24 * 60 * 60 * 1000; // ~10y

/**
 * Every currency that needs a provider-backed rate against EUR, keyed by
 * `Currency` so the type system forces this list to grow with the enum.
 *
 * DO NOT flatten this back into a literal `FxPair[]`. As a plain array it was a
 * hardcoded two-currency list with nothing tying it to `Currency`: adding a
 * third member compiled clean, no rate was ever fetched for its pairs, and the
 * platform silently could not take a booking in it (`getRate` 503s at reserve).
 * That fails in the safe direction - no mispricing - but with zero build signal,
 * which is the same silent-drift bug the `never` guard in `fx.util.ts` closes.
 *
 * EUR is excluded because it is the base: EUR->EUR is the identity rate.
 */
const CROSS_CURRENCIES: Record<Exclude<Currency, 'EUR'>, true> = { USD: true };

/** Pairs the platform actively converts (both directions against EUR). */
const REQUIRED_PAIRS: FxPair[] = (
  Object.keys(CROSS_CURRENCIES) as Exclude<Currency, 'EUR'>[]
).flatMap((currency) => [
  { from: currency, to: Currency.EUR },
  { from: Currency.EUR, to: currency },
]);

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Single source for FX rates (guide §20.1). Cross-currency rates come only from the
 * provider-backed `fx_rates` cache; a rate used by a quote/payment is snapshotted onto
 * the booking and never refetched. Fails closed: if no acceptable rate exists, the
 * booking path throws `503` rather than guessing.
 *
 * All money/rate math uses `Decimal` (never JS float).
 */
@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FX_PROVIDER) private readonly provider: FxProvider,
  ) {}

  /**
   * A FRESH, non-expired rate (booking quote / payment path). If none is cached, it
   * lazily refreshes once (so dev/test are self-sufficient; the scheduler keeps it warm
   * in prod), then fails closed with `503` if still unavailable.
   */
  async getRate(from: Currency, to: Currency): Promise<FxQuote> {
    if (from === to) return this.identityRate(from, to);

    const fresh = await this.latestActive(from, to, { allowStale: false });
    if (fresh) return fresh;

    // No fresh cached rate: attempt a single on-demand refresh, then re-read.
    await this.refreshRates().catch((err) =>
      this.logger.error('FX on-demand refresh failed', err as Error),
    );
    const after = await this.latestActive(from, to, { allowStale: false });
    if (after) return after;

    throw new ServiceUnavailableException(
      'Payments temporarily unavailable (no FX rate)',
    );
  }

  /**
   * A rate for PUBLIC DISPLAY only: prefers fresh, but accepts a stale rate within the
   * display window. Returns null when not even a stale rate is available (caller should
   * then fall back to source-currency display, never block the page).
   */
  async getDisplayRate(from: Currency, to: Currency): Promise<FxQuote | null> {
    if (from === to) return this.identityRate(from, to);
    const fresh = await this.latestActive(from, to, { allowStale: false });
    if (fresh) return fresh;
    return this.latestActive(from, to, { allowStale: true });
  }

  /** Convert an amount using a fresh rate; rounds HALF_UP to 2dp at the boundary. */
  async convert(
    amount: Prisma.Decimal,
    from: Currency,
    to: Currency,
  ): Promise<{ amount: Prisma.Decimal; rate: FxQuote }> {
    const rate = await this.getRate(from, to);
    return {
      amount: amount
        .mul(rate.rate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      rate,
    };
  }

  /**
   * Build the canonical converted-price `money` object for a PUBLIC display response
   * (guide §20.9). Uses a display rate (stale allowed); if none is available it falls
   * back to source currency (rate 1) so a page never blocks on FX. Amounts are strings.
   */
  async buildMoney(
    sourceCurrency: Currency,
    targetCurrency: Currency,
    amounts: {
      priceFrom?: Prisma.Decimal | null;
      basePrice?: Prisma.Decimal | null;
    },
  ): Promise<{
    currency: Currency;
    sourceCurrency: Currency;
    fxRate: string;
    priceFrom: string | null;
    basePrice: string | null;
  }> {
    const display =
      sourceCurrency === targetCurrency
        ? null
        : await this.getDisplayRate(sourceCurrency, targetCurrency);
    // Fall back to source currency when no rate is available - never block a page.
    const currency = display ? targetCurrency : sourceCurrency;
    const rate = display ? display.rate : new Prisma.Decimal(1);
    const conv = (v: Prisma.Decimal | null | undefined): string | null =>
      v == null ? null : retailWhole(v.mul(rate)).toString();
    return {
      currency,
      sourceCurrency,
      fxRate: rate.toString(),
      priceFrom: conv(amounts.priceFrom),
      basePrice: conv(amounts.basePrice),
    };
  }

  /**
   * Attach the public display `money` object (guide §20.9) to each card/detail item
   * IN PLACE. The single reusable implementation shared by every listing surface
   * (tours, hubs, collections, wishlist): it resolves each DISTINCT source currency's
   * display rate once (<= number-of-currencies DB reads), then converts synchronously.
   * Falls back to the item's own source currency (rate 1) when no rate is available,
   * so a page never blocks on FX.
   *
   * @param items      cards to annotate (mutated: `item.money` is set)
   * @param target     the shopper display currency; when omitted, money = source
   * @param sourceKey  the property holding each item's source currency
   *                   ('defaultCurrency' for the tour shape, 'currency' for hub cards)
   */
  async attachMoney(
    items: Array<
      Record<string, unknown> & {
        priceFrom?: unknown;
        basePrice?: unknown;
        money?: unknown;
      }
    >,
    target?: Currency,
    sourceKey: 'defaultCurrency' | 'currency' = 'defaultCurrency',
  ): Promise<void> {
    if (items.length === 0) return;
    const srcOf = (it: Record<string, unknown>): string =>
      String(it[sourceKey]);

    const rateBySource = new Map<
      string,
      { currency: string; rate: Prisma.Decimal }
    >();
    for (const src of new Set(items.map(srcOf))) {
      const tgt = target ?? (src as Currency);
      if (src === tgt) {
        rateBySource.set(src, { currency: src, rate: new Prisma.Decimal(1) });
        continue;
      }
      const display = await this.getDisplayRate(src as Currency, tgt);
      rateBySource.set(
        src,
        display
          ? { currency: tgt, rate: display.rate }
          : { currency: src, rate: new Prisma.Decimal(1) }, // fallback: show source
      );
    }

    for (const it of items) {
      const { currency, rate } = rateBySource.get(srcOf(it))!;
      const conv = (v: unknown): string | null =>
        v == null
          ? null
          : retailWhole(
              new Prisma.Decimal(v as Prisma.Decimal.Value).mul(rate),
            ).toString();
      it.money = {
        currency,
        sourceCurrency: srcOf(it),
        fxRate: rate.toString(),
        priceFrom: conv(it.priceFrom),
        basePrice: conv(it.basePrice),
      };
    }
  }

  /**
   * Attach the public display `money` object to a tour DETAIL, IN PLACE -
   * including every child retail amount the booking widget prices from: age
   * bands, add-ons, priced pickup zones and the per-extra-guest surcharge.
   *
   * `attachMoney` above converts only the two headline figures, which is all a
   * CARD renders. A detail feeds the booking widget, and the widget used to
   * convert the rest itself by multiplying each source price by `fxRate`. That
   * produced numbers this service would never have produced: a $139 tour showed
   * the card's whole "128" beside the widget's own "127,88", and a $39 add-on
   * rendered as "35,88 EUR" - cents on a platform whose every other
   * traveller-facing amount is a whole unit (Pastel #41).
   *
   * So the conversion happens once, here, at the same `retailWhole` the quote
   * and the booking totals use, and the frontend renders what it is given.
   *
   * Ceiling each child rather than the sum can put the widget's optimistic total
   * a unit above the quote's on a party that mixes several fractional bands. The
   * quote is authoritative and replaces the estimate the moment it lands; the
   * alternative is showing cents on the rows, which is the thing being fixed.
   *
   * Falls back to source currency at rate 1 when no display rate is available,
   * exactly like `attachMoney` - a page never blocks on FX.
   */
  async attachDetailMoney(
    detail: Record<string, unknown> & {
      defaultCurrency?: unknown;
      priceFrom?: unknown;
      basePrice?: unknown;
      extraPersonPrice?: unknown;
      ageBands?: Array<{ id: string; price?: unknown }>;
      addOns?: Array<{ id: string; price?: unknown }>;
      pickupLocations?: Array<{ id: string; price?: unknown }>;
      money?: unknown;
    },
    target?: Currency,
  ): Promise<void> {
    const source = String(detail.defaultCurrency) as Currency;
    const tgt = target ?? source;

    let currency: Currency = source;
    let rate = new Prisma.Decimal(1);
    if (source !== tgt) {
      const display = await this.getDisplayRate(source, tgt);
      if (display) {
        currency = tgt;
        rate = display.rate;
      }
    }

    const conv = (v: unknown): string | null =>
      v == null
        ? null
        : retailWhole(
            new Prisma.Decimal(v as Prisma.Decimal.Value).mul(rate),
          ).toString();

    /** id -> converted price, skipping children with no price of their own. */
    const byId = (
      rows: Array<{ id: string; price?: unknown }> | undefined,
    ): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const row of rows ?? []) {
        const value = conv(row.price);
        if (value != null) out[row.id] = value;
      }
      return out;
    };

    detail.money = {
      currency,
      sourceCurrency: source,
      fxRate: rate.toString(),
      priceFrom: conv(detail.priceFrom),
      basePrice: conv(detail.basePrice),
      extraPersonPrice: conv(detail.extraPersonPrice),
      ageBands: byId(detail.ageBands),
      addOns: byId(detail.addOns),
      pickupLocations: byId(detail.pickupLocations),
    };
  }

  /**
   * Fetch the required pairs from the provider, validate they are positive, write a new
   * active row per pair, and deactivate the prior active row for that pair (immutable
   * history). Safe to call repeatedly (the scheduler and on-demand path both use it).
   *
   * IDEMPOTENT per snapshot: the row is UPSERTED on the unique
   * (base, quote, providerAsOf, provider) key. ECB publishes ONE rate per day,
   * so every restart and every 30-minute refresh inside the same day re-fetches
   * the SAME snapshot - a plain create would P2002 and abort the whole refresh
   * (the exact "FX startup refresh failed" production error). The upsert
   * re-activates the existing snapshot row and extends its freshness window
   * instead; a genuinely new provider snapshot still inserts a new history row.
   */
  async refreshRates(): Promise<void> {
    const rows = await this.provider.fetchRates(REQUIRED_PAIRS);
    const now = new Date();
    const ttlMs = envInt('FX_RATE_TTL_MINUTES', DEFAULT_TTL_MINUTES) * 60_000;

    let written = 0;
    for (const r of rows) {
      if (!r.rate.gt(0)) {
        this.logger.warn(
          `Rejected non-positive ${r.baseCurrency}->${r.quoteCurrency} rate from ${this.provider.name}`,
        );
        continue;
      }
      const expiresAt = new Date(now.getTime() + ttlMs);
      await this.prisma.$transaction([
        this.prisma.fxRate.updateMany({
          where: {
            baseCurrency: r.baseCurrency,
            quoteCurrency: r.quoteCurrency,
            isActive: true,
          },
          data: { isActive: false },
        }),
        this.prisma.fxRate.upsert({
          where: {
            baseCurrency_quoteCurrency_providerAsOf_provider: {
              baseCurrency: r.baseCurrency,
              quoteCurrency: r.quoteCurrency,
              providerAsOf: r.providerAsOf,
              provider: this.provider.name,
            },
          },
          create: {
            baseCurrency: r.baseCurrency,
            quoteCurrency: r.quoteCurrency,
            rate: r.rate,
            provider: this.provider.name,
            providerAsOf: r.providerAsOf,
            expiresAt,
          },
          // Same provider snapshot seen again (restart / same-day refresh):
          // keep it the active row and extend its freshness window.
          update: {
            rate: r.rate,
            expiresAt,
            isActive: true,
            fetchedAt: now,
          },
        }),
      ]);
      written++;
    }
    if (written) {
      this.logger.log(
        `FX refreshed ${written} pair(s) via ${this.provider.name}`,
      );
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private identityRate(from: Currency, to: Currency): FxQuote {
    const now = new Date();
    return {
      baseCurrency: from,
      quoteCurrency: to,
      rate: new Prisma.Decimal(1),
      provider: 'same-currency',
      providerAsOf: now,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + IDENTITY_TTL_MS),
    };
  }

  private async latestActive(
    from: Currency,
    to: Currency,
    { allowStale }: { allowStale: boolean },
  ): Promise<FxQuote | null> {
    const now = new Date();
    const row = await this.prisma.fxRate.findFirst({
      where: {
        baseCurrency: from,
        quoteCurrency: to,
        isActive: true,
        ...(allowStale ? {} : { expiresAt: { gt: now } }),
      },
      orderBy: { providerAsOf: 'desc' },
    });
    if (!row) return null;

    if (allowStale) {
      // Reject a rate older than the display staleness window entirely.
      const staleCutoff = new Date(
        now.getTime() -
          envInt('FX_RATE_STALE_DISPLAY_HOURS', DEFAULT_STALE_DISPLAY_HOURS) *
            3_600_000,
      );
      if (row.providerAsOf < staleCutoff) return null;
    }

    return {
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: row.rate,
      provider: row.provider,
      providerAsOf: row.providerAsOf,
      fetchedAt: row.fetchedAt,
      expiresAt: row.expiresAt,
    };
  }
}
