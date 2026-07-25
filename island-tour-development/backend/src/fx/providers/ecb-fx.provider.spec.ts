import { Currency } from '@prisma/client';
import { EcbFxProvider } from './ecb-fx.provider';

const USD_EUR = [
  { from: Currency.USD, to: Currency.EUR },
  { from: Currency.EUR, to: Currency.USD },
];

describe('EcbFxProvider', () => {
  let provider: EcbFxProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new EcbFxProvider();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  function okJson(body: unknown) {
    return { ok: true, status: 200, json: () => Promise.resolve(body) };
  }

  it('returns EUR->USD from ECB and USD->EUR as its exact inverse', async () => {
    fetchMock.mockResolvedValue(
      okJson({ date: '2026-07-24', rates: { USD: 1.08 } }),
    );

    const rates = await provider.fetchRates(USD_EUR);

    const eurUsd = rates.find(
      (r) =>
        r.baseCurrency === Currency.EUR && r.quoteCurrency === Currency.USD,
    );
    const usdEur = rates.find(
      (r) =>
        r.baseCurrency === Currency.USD && r.quoteCurrency === Currency.EUR,
    );
    expect(eurUsd?.rate.toString()).toBe('1.08');
    expect(usdEur?.rate.toString()).toBe('0.92592593'); // 1/1.08 at 8dp
    // Provenance anchored to the ECB calendar day at noon UTC.
    expect(eurUsd?.providerAsOf.toISOString()).toBe('2026-07-24T12:00:00.000Z');
  });

  it('returns [] on a non-2xx response (never throws)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => ({}) });
    await expect(provider.fetchRates(USD_EUR)).resolves.toEqual([]);
  });

  it('returns [] when the fetch rejects / times out (never throws)', async () => {
    fetchMock.mockRejectedValue(new Error('aborted'));
    await expect(provider.fetchRates(USD_EUR)).resolves.toEqual([]);
  });

  it.each([{ USD: 0 }, { USD: -1 }, {}])(
    'returns [] when the payload has no positive USD rate (%p)',
    async (rates) => {
      fetchMock.mockResolvedValue(okJson({ date: '2026-07-24', rates }));
      await expect(provider.fetchRates(USD_EUR)).resolves.toEqual([]);
    },
  );

  it('skips the network call entirely when no USD<->EUR pair is requested', async () => {
    const rates = await provider.fetchRates([
      { from: Currency.EUR, to: Currency.EUR },
    ]);
    expect(rates).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
