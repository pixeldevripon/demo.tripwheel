import { Logger } from '@nestjs/common';
import type {
  FxPair,
  FxProvider,
  ProviderRate,
} from '../fx-provider.interface';

/**
 * Runs a PRIMARY provider, then fills any still-missing pairs from a FALLBACK
 * provider. Used ONLY in non-production (the "hybrid" degrade): if the real
 * reference provider is unreachable, local dev/staging still converts via the
 * static rate instead of failing closed. Production binds the primary ALONE, so a
 * provider outage there writes no rows and cross-currency correctly fails closed
 * downstream (master failure matrix).
 *
 * `name` reports the PRIMARY's name for audit continuity; the static-filled rows
 * are a dev-only convenience, and production never uses this wrapper.
 */
export class CompositeFxProvider implements FxProvider {
  readonly name: string;
  private readonly logger = new Logger(CompositeFxProvider.name);

  constructor(
    private readonly primary: FxProvider,
    private readonly fallback: FxProvider,
  ) {
    this.name = primary.name;
  }

  async fetchRates(pairs: FxPair[]): Promise<ProviderRate[]> {
    const primaryRates = await this.primary.fetchRates(pairs);
    const have = new Set(
      primaryRates.map((r) => `${r.baseCurrency}->${r.quoteCurrency}`),
    );
    const missing = pairs.filter(
      (p) => p.from !== p.to && !have.has(`${p.from}->${p.to}`),
    );
    if (missing.length === 0) return primaryRates;

    this.logger.warn(
      `${this.primary.name} did not return ${missing.length} pair(s); ` +
        `falling back to ${this.fallback.name} (non-production only)`,
    );
    const fallbackRates = await this.fallback.fetchRates(missing);
    return [...primaryRates, ...fallbackRates];
  }
}
