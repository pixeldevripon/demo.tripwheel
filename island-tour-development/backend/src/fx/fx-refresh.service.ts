import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { FxRatesService } from './fx-rates.service';

const DEFAULT_REFRESH_MINUTES = 30;
const INTERVAL_NAME = 'fx-rate-refresh';

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Keeps the `fx_rates` cache warm (guide §20.1). Runs on `@nestjs/schedule`
 * in-process (NightlyJobsService moved to BullMQ job schedulers in hardening
 * F8; this one deliberately did not - an FX refresh double-running on two
 * replicas is a harmless idempotent upsert, and it must keep working with
 * Redis down since rates gate bookings).
 *
 * Two triggers:
 *   - **Startup**: one refresh at boot so the first booking quote does not pay the
 *     provider round-trip and cross-currency works immediately when reachable.
 *   - **Interval**: every `FX_RATE_REFRESH_MINUTES` (default 30) thereafter, so a rate
 *     stays fresh well inside its `FX_RATE_TTL_MINUTES` (default 120) window.
 *
 * Failure is deliberately NON-FATAL: a refresh that throws is logged and swallowed so
 * boot and the interval survive. Correctness is enforced downstream instead - a booking
 * quote fails closed (503) when no fresh rate exists, and public display falls back to
 * source currency - so this service never blocks a request or the app lifecycle.
 * The cadence is registered dynamically (not a `@Interval` literal) to honour the env var.
 */
@Injectable()
export class FxRefreshService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(FxRefreshService.name);

  constructor(
    private readonly fx: FxRatesService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.refresh('startup');
    this.registerInterval();
  }

  onModuleDestroy(): void {
    // SchedulerRegistry clears its own intervals on graceful shutdown, but clear
    // defensively so a torn-down module (tests / hot-reload) leaves no live timer.
    if (this.scheduler.doesExist('interval', INTERVAL_NAME)) {
      this.scheduler.deleteInterval(INTERVAL_NAME);
    }
  }

  private registerInterval(): void {
    // Guard against a double bootstrap (hot-reload) re-adding the same interval.
    if (this.scheduler.doesExist('interval', INTERVAL_NAME)) return;
    const minutes = envInt('FX_RATE_REFRESH_MINUTES', DEFAULT_REFRESH_MINUTES);
    const handle = setInterval(() => {
      void this.refresh('scheduled');
    }, minutes * 60_000);
    this.scheduler.addInterval(INTERVAL_NAME, handle);
    this.logger.log(`FX rate refresh scheduled every ${minutes} min`);
  }

  /** Refresh wrapper that never throws, so boot and the interval stay alive. */
  private async refresh(trigger: 'startup' | 'scheduled'): Promise<void> {
    try {
      await this.fx.refreshRates();
    } catch (err) {
      this.logger.warn(
        `FX ${trigger} refresh failed; serving cached rates if available ` +
          `(cross-currency quotes fail closed until a fresh rate lands)`,
        err as Error,
      );
    }
  }
}
