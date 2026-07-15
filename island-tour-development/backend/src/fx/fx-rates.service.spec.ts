import { ServiceUnavailableException } from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { FxRatesService } from './fx-rates.service';
import type { FxProvider } from './fx-provider.interface';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

function activeRow(over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    baseCurrency: Currency.USD,
    quoteCurrency: Currency.EUR,
    rate: D('0.92'),
    provider: 'static-dev',
    providerAsOf: new Date(now - 60_000),
    fetchedAt: new Date(now - 60_000),
    expiresAt: new Date(now + 3_600_000), // fresh
    isActive: true,
    ...over,
  };
}

function mockPrisma() {
  return {
    fxRate: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([{}, {}]),
  } as any;
}

describe('FxRatesService', () => {
  let prisma: any;
  let provider: FxProvider;
  let svc: FxRatesService;

  beforeEach(() => {
    prisma = mockPrisma();
    provider = {
      name: 'static-dev',
      fetchRates: jest.fn().mockResolvedValue([
        {
          baseCurrency: Currency.USD,
          quoteCurrency: Currency.EUR,
          rate: D('0.92'),
          providerAsOf: new Date(),
        },
      ]),
    };
    svc = new FxRatesService(prisma, provider);
  });

  it('returns an identity rate for same-currency without touching provider/DB', async () => {
    const q = await svc.getRate(Currency.EUR, Currency.EUR);
    expect(q.rate.toString()).toBe('1');
    expect(q.provider).toBe('same-currency');
    expect(prisma.fxRate.findFirst).not.toHaveBeenCalled();
    expect(provider.fetchRates).not.toHaveBeenCalled();
  });

  it('returns a fresh cached cross-currency rate', async () => {
    prisma.fxRate.findFirst.mockResolvedValue(activeRow());
    const q = await svc.getRate(Currency.USD, Currency.EUR);
    expect(q.rate.toString()).toBe('0.92');
    expect(provider.fetchRates).not.toHaveBeenCalled();
  });

  it('lazily refreshes when no fresh rate is cached, then returns it', async () => {
    prisma.fxRate.findFirst
      .mockResolvedValueOnce(null) // first lookup: nothing fresh
      .mockResolvedValueOnce(activeRow()); // after refresh
    const q = await svc.getRate(Currency.USD, Currency.EUR);
    expect(provider.fetchRates).toHaveBeenCalledTimes(1);
    expect(q.rate.toString()).toBe('0.92');
  });

  it('fails closed with 503 when no rate is available even after refresh', async () => {
    prisma.fxRate.findFirst.mockResolvedValue(null);
    await expect(
      svc.getRate(Currency.USD, Currency.EUR),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('convert applies the rate and rounds to 2dp', async () => {
    prisma.fxRate.findFirst.mockResolvedValue(activeRow());
    const { amount, rate } = await svc.convert(
      D('100'),
      Currency.USD,
      Currency.EUR,
    );
    expect(amount.toString()).toBe('92'); // 100 * 0.92
    expect(rate.rate.toString()).toBe('0.92');
  });

  it('refreshRates writes a new active row and deactivates the prior one', async () => {
    await svc.refreshRates();
    expect(prisma.fxRate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
        data: { isActive: false },
      }),
    );
    expect(prisma.fxRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          baseCurrency: Currency.USD,
          quoteCurrency: Currency.EUR,
          provider: 'static-dev',
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects a non-positive rate from the provider', async () => {
    (provider.fetchRates as jest.Mock).mockResolvedValue([
      {
        baseCurrency: Currency.USD,
        quoteCurrency: Currency.EUR,
        rate: D('0'),
        providerAsOf: new Date(),
      },
    ]);
    await svc.refreshRates();
    expect(prisma.fxRate.create).not.toHaveBeenCalled();
  });

  describe('getDisplayRate', () => {
    it('falls back to a stale rate within the display window', async () => {
      prisma.fxRate.findFirst
        .mockResolvedValueOnce(null) // no fresh
        .mockResolvedValueOnce(
          activeRow({
            expiresAt: new Date(Date.now() - 60_000), // expired
            providerAsOf: new Date(Date.now() - 3_600_000), // 1h old, within 24h
          }),
        );
      const q = await svc.getDisplayRate(Currency.USD, Currency.EUR);
      expect(q?.rate.toString()).toBe('0.92');
    });

    it('returns null when even the stale rate is older than the display window', async () => {
      prisma.fxRate.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(
        activeRow({
          expiresAt: new Date(Date.now() - 60_000),
          providerAsOf: new Date(Date.now() - 48 * 3_600_000), // 48h old, past 24h
        }),
      );
      const q = await svc.getDisplayRate(Currency.USD, Currency.EUR);
      expect(q).toBeNull();
    });
  });
});
