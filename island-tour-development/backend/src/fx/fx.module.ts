import { Module } from '@nestjs/common';
import { FX_PROVIDER } from './fx-provider.interface';
import { StaticFxProvider } from './providers/static-fx.provider';
import { FxRatesService } from './fx-rates.service';

/**
 * FX rates module - the single source for currency conversion (guide §20.1). Swap the
 * bound {@link FX_PROVIDER} (dev-static ⇄ Stripe FX Quotes / Open Exchange Rates)
 * without touching consumers. Exports {@link FxRatesService} for booking pricing and
 * the public display APIs.
 */
@Module({
  providers: [
    FxRatesService,
    StaticFxProvider,
    { provide: FX_PROVIDER, useExisting: StaticFxProvider },
  ],
  exports: [FxRatesService],
})
export class FxModule {}
