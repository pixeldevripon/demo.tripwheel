import { Currency, Prisma } from '@prisma/client';
import { CompositeFxProvider } from './composite-fx.provider';
import type {
  FxPair,
  FxProvider,
  ProviderRate,
} from '../fx-provider.interface';

const PAIRS: FxPair[] = [
  { from: Currency.USD, to: Currency.EUR },
  { from: Currency.EUR, to: Currency.USD },
];

function rate(from: Currency, to: Currency, value: string): ProviderRate {
  return {
    baseCurrency: from,
    quoteCurrency: to,
    rate: new Prisma.Decimal(value),
    providerAsOf: new Date('2026-07-24T12:00:00.000Z'),
  };
}

function stub(
  name: string,
  rates: ProviderRate[],
): FxProvider & {
  fetchRates: jest.Mock;
} {
  return { name, fetchRates: jest.fn().mockResolvedValue(rates) };
}

describe('CompositeFxProvider', () => {
  it('reports the PRIMARY provider name', () => {
    const composite = new CompositeFxProvider(
      stub('ecb', []),
      stub('static-dev', []),
    );
    expect(composite.name).toBe('ecb');
  });

  it('does NOT call the fallback when the primary returns every pair', async () => {
    const primary = stub('ecb', [
      rate(Currency.USD, Currency.EUR, '0.92'),
      rate(Currency.EUR, Currency.USD, '1.08'),
    ]);
    const fallback = stub('static-dev', []);
    const composite = new CompositeFxProvider(primary, fallback);

    const rates = await composite.fetchRates(PAIRS);

    expect(rates).toHaveLength(2);
    expect(fallback.fetchRates).not.toHaveBeenCalled();
  });

  it('fills ALL pairs from the fallback when the primary returns none', async () => {
    const primary = stub('ecb', []);
    const fallback = stub('static-dev', [
      rate(Currency.USD, Currency.EUR, '0.92'),
      rate(Currency.EUR, Currency.USD, '1.087'),
    ]);
    const composite = new CompositeFxProvider(primary, fallback);

    const rates = await composite.fetchRates(PAIRS);

    expect(rates).toHaveLength(2);
    // Fallback asked for exactly the missing pairs.
    expect(fallback.fetchRates).toHaveBeenCalledWith(PAIRS);
  });

  it('fills only the MISSING pair when the primary returns a partial set', async () => {
    const primary = stub('ecb', [rate(Currency.EUR, Currency.USD, '1.08')]);
    const fallback = stub('static-dev', [
      rate(Currency.USD, Currency.EUR, '0.92'),
    ]);
    const composite = new CompositeFxProvider(primary, fallback);

    const rates = await composite.fetchRates(PAIRS);

    expect(rates).toHaveLength(2);
    expect(fallback.fetchRates).toHaveBeenCalledWith([
      { from: Currency.USD, to: Currency.EUR },
    ]);
  });
});
