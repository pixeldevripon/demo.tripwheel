import { Injectable, Logger } from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { usdToEurRate } from '@/common/utils/fx.util';
import type {
  FxPair,
  FxProvider,
  ProviderRate,
} from '../fx-provider.interface';

/**
 * Development / test FX provider. Derives USD⇄EUR from `FX_USD_TO_EUR` (via the existing
 * fx.util default 0.92) with no network call, so local dev and tests convert currency
 * without a provider account.
 *
 * Production must swap in a real provider behind the same {@link FxProvider} interface
 * (guide §20.1 recommends Stripe FX Quotes) and fail closed for cross-currency checkout
 * when no provider-backed rate exists - never ship this static rate to production.
 */
@Injectable()
export class StaticFxProvider implements FxProvider {
  readonly name = 'static-dev';
  private readonly logger = new Logger(StaticFxProvider.name);

  fetchRates(pairs: FxPair[]): Promise<ProviderRate[]> {
    const asOf = new Date();
    const usdToEur = usdToEurRate().toDecimalPlaces(8);
    const eurToUsd = new Prisma.Decimal(1)
      .dividedBy(usdToEur)
      .toDecimalPlaces(8);

    const rates: ProviderRate[] = [];
    for (const p of pairs) {
      if (p.from === p.to) continue; // same-currency is rate 1, handled by the service
      const rate =
        p.from === Currency.USD && p.to === Currency.EUR
          ? usdToEur
          : p.from === Currency.EUR && p.to === Currency.USD
            ? eurToUsd
            : null;
      if (rate == null) {
        this.logger.warn(`No static rate for ${p.from}->${p.to}`);
        continue;
      }
      rates.push({
        baseCurrency: p.from,
        quoteCurrency: p.to,
        rate,
        providerAsOf: asOf,
      });
    }
    return Promise.resolve(rates);
  }
}
