import { SchedulerRegistry } from '@nestjs/schedule';
import { FxRatesService } from './fx-rates.service';
import { FxRefreshService } from './fx-refresh.service';

const INTERVAL_NAME = 'fx-rate-refresh';

function mockScheduler() {
  let exists = false;
  let handle: NodeJS.Timeout | undefined;
  return {
    doesExist: jest.fn(() => exists),
    addInterval: jest.fn((_name: string, h: NodeJS.Timeout) => {
      exists = true;
      handle = h;
    }),
    deleteInterval: jest.fn((_name: string) => {
      exists = false;
      if (handle) clearInterval(handle);
    }),
  } as unknown as SchedulerRegistry;
}

describe('FxRefreshService', () => {
  let fx: { refreshRates: jest.Mock };
  let scheduler: SchedulerRegistry;
  let service: FxRefreshService;

  beforeEach(() => {
    jest.useFakeTimers();
    fx = { refreshRates: jest.fn().mockResolvedValue(undefined) };
    scheduler = mockScheduler();
    service = new FxRefreshService(fx as unknown as FxRatesService, scheduler);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllTimers();
    jest.useRealTimers();
    delete process.env.FX_RATE_REFRESH_MINUTES;
  });

  it('refreshes once at startup and registers the interval', async () => {
    await service.onApplicationBootstrap();

    expect(fx.refreshRates).toHaveBeenCalledTimes(1); // startup warm-up
    expect(scheduler.addInterval).toHaveBeenCalledWith(
      INTERVAL_NAME,
      expect.anything(),
    );
  });

  it('swallows a startup refresh failure and still registers the interval', async () => {
    fx.refreshRates.mockRejectedValueOnce(new Error('provider down'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);
  });

  it('fires a scheduled refresh on the interval cadence', async () => {
    process.env.FX_RATE_REFRESH_MINUTES = '30';
    await service.onApplicationBootstrap();
    expect(fx.refreshRates).toHaveBeenCalledTimes(1); // startup only, so far

    jest.advanceTimersByTime(30 * 60_000);
    expect(fx.refreshRates).toHaveBeenCalledTimes(2); // + one scheduled tick

    jest.advanceTimersByTime(30 * 60_000);
    expect(fx.refreshRates).toHaveBeenCalledTimes(3);
  });

  it('does not double-register the interval on a repeat bootstrap', async () => {
    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);
  });

  it('clears the interval on module destroy', async () => {
    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(scheduler.deleteInterval).toHaveBeenCalledWith(INTERVAL_NAME);
  });
});
