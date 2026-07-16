import { Module } from '@nestjs/common';
import { FX_PROVIDER } from './fx-provider.interface';
import { StaticFxProvider } from './providers/static-fx.provider';
import { FxRatesService } from './fx-rates.service';
import { FxRefreshService } from './fx-refresh.service';

/**
 * FX rates module - the single source for currency conversion (guide §20.1). Swap the
 * bound {@link FX_PROVIDER} (dev-static ⇄ Stripe FX Quotes / Open Exchange Rates)
 * without touching consumers. Exports {@link FxRatesService} for booking pricing and
 * the public display APIs; {@link FxRefreshService} keeps the rate cache warm on a
 * startup + interval schedule (relies on the global `ScheduleModule.forRoot()` in
 * AppModule for {@link SchedulerRegistry}).
 */
@Module({
  providers: [
    FxRatesService,
    FxRefreshService,
    StaticFxProvider,
    { provide: FX_PROVIDER, useExisting: StaticFxProvider },
  ],
  exports: [FxRatesService],
})
export class FxModule {}
