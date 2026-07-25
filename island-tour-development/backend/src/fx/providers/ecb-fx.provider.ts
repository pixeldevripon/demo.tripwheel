import { Injectable, Logger } from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import type {
  FxPair,
  FxProvider,
  ProviderRate,
} from '../fx-provider.interface';

/**
 * ECB reference-rate FX provider (master FX doc: "ECB as a reference source").
 *
 * Sourced from the Frankfurter API (https://frankfurter.dev) - the European
 * Central Bank's daily reference rates served as keyless JSON, so no account or
 * API key is needed. One request (base EUR) yields EUR->USD directly; USD->EUR is
 * its exact inverse. ECB publishes ~16:00 CET on TARGET business days, well inside
 * our refresh cadence + TTL, so a rate is always available on a normal day.
 *
 * These are REFERENCE/DISPLAY rates. The rate a traveler is actually CHARGED comes
 * from Stripe's own `currency_conversion` on the PaymentIntent (payments phase) so
 * display and charge can share one locked rate - the master's charge-side plan.
 *
 * NEVER throws: any network / HTTP / parse / bad-value failure logs and returns an
 * empty list, so the refresh scheduler stays alive and correctness is enforced
 * downstream (booking quote fails closed, display falls back to source currency).
 */
@Injectable()
export class EcbFxProvider implements FxProvider {
  readonly name = 'ecb';
  private readonly logger = new Logger(EcbFxProvider.name);

  /** ECB daily reference rates as keyless JSON (base EUR). */
  private static readonly ENDPOINT =
    'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD';
  private static readonly TIMEOUT_MS = 4000;

  async fetchRates(pairs: FxPair[]): Promise<ProviderRate[]> {
    // We only source the launch currencies (USD<->EUR); anything else is left to
    // the caller's fallback. Skip the network call if no supported pair is asked.
    const wantsUsdEur = pairs.some(
      (p) =>
        (p.from === Currency.EUR && p.to === Currency.USD) ||
        (p.from === Currency.USD && p.to === Currency.EUR),
    );
    if (!wantsUsdEur) return [];

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      EcbFxProvider.TIMEOUT_MS,
    );
    try {
      const res = await fetch(EcbFxProvider.ENDPOINT, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        this.logger.warn(
          `ECB rates HTTP ${res.status} - skipping this refresh`,
        );
        return [];
      }
      const body = (await res.json()) as {
        date?: string;
        rates?: Record<string, number>;
      };
      const eurToUsdRaw = body?.rates?.USD;
      if (typeof eurToUsdRaw !== 'number' || !(eurToUsdRaw > 0)) {
        this.logger.warn('ECB rates payload missing a positive EUR->USD rate');
        return [];
      }

      // ECB's `date` is a UTC calendar day (YYYY-MM-DD); anchor provenance to noon
      // UTC so it is unambiguous. Fall back to "now" only if the field is absent.
      const providerAsOf = body.date
        ? new Date(`${body.date}T12:00:00.000Z`)
        : new Date();
      const eurToUsd = new Prisma.Decimal(eurToUsdRaw).toDecimalPlaces(8);
      const usdToEur = new Prisma.Decimal(1)
        .dividedBy(eurToUsd)
        .toDecimalPlaces(8);

      return [
        {
          baseCurrency: Currency.EUR,
          quoteCurrency: Currency.USD,
          rate: eurToUsd,
          providerAsOf,
        },
        {
          baseCurrency: Currency.USD,
          quoteCurrency: Currency.EUR,
          rate: usdToEur,
          providerAsOf,
        },
      ];
    } catch (err) {
      // Timeout/abort/network/parse - never propagate; the scheduler must survive.
      this.logger.warn(
        `ECB rates fetch failed - skipping this refresh: ${(err as Error).message}`,
      );
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
