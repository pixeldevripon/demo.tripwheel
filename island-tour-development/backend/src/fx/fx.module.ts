import { Module } from '@nestjs/common';
import type { FxProvider } from './fx-provider.interface';
import { FX_PROVIDER } from './fx-provider.interface';
import { StaticFxProvider } from './providers/static-fx.provider';
import { EcbFxProvider } from './providers/ecb-fx.provider';
import { CompositeFxProvider } from './providers/composite-fx.provider';
import { FxRatesService } from './fx-rates.service';
import { FxRefreshService } from './fx-refresh.service';

/**
 * Select the active FX provider from `FX_PROVIDER` (master FX doc):
 *   - unset / 'static' -> {@link StaticFxProvider} (the 0.92 dev rate; today's default).
 *   - 'ecb'            -> {@link EcbFxProvider} (keyless ECB reference rates).
 *
 * HYBRID fallback (the founder's chosen outage policy): in non-production, a real
 * provider is wrapped so any pair it fails to return is filled from the static rate,
 * so local dev/staging always converts. In PRODUCTION the real provider runs ALONE -
 * an outage writes no rows and cross-currency fails closed downstream (getRate 503),
 * never silently charging the stale static rate.
 */
function createFxProvider(): FxProvider {
  const selector = (process.env.FX_PROVIDER ?? 'static').toLowerCase();
  if (selector !== 'ecb') return new StaticFxProvider();

  const real = new EcbFxProvider();
  if (process.env.NODE_ENV === 'production') return real;
  return new CompositeFxProvider(real, new StaticFxProvider());
}

/**
 * FX rates module - the single source for currency conversion (guide §20.1). Swap the
 * bound {@link FX_PROVIDER} (dev-static / ECB reference; Stripe handles the CHARGE rate
 * in the payments phase) without touching consumers. Exports {@link FxRatesService} for
 * booking pricing and the public display APIs; {@link FxRefreshService} keeps the rate
 * cache warm on a startup + interval schedule (relies on the global
 * `ScheduleModule.forRoot()` in AppModule for {@link SchedulerRegistry}).
 */
@Module({
  providers: [
    FxRatesService,
    FxRefreshService,
    { provide: FX_PROVIDER, useFactory: createFxProvider },
  ],
  exports: [FxRatesService],
})
export class FxModule {}
