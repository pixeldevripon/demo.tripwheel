import { describe, expect, it } from 'vitest';

import { deriveDisplayRate, formatPriceFrom } from './current';

/**
 * The bridge between backend SOURCE-currency aggregates and what a shopper
 * reads. The backend does not convert the hub and collection "from" fast-stats
 * (guide §20.9 defers them), so these figures are multiplied client-side by a
 * rate derived from whichever converted tours the page happens to have.
 *
 * Which makes `converted` the important field: when the set carries no rate,
 * the answer is the IDENTITY rate under the shopper's own currency, and
 * printing that is not a rounding error - it is a different price.
 */

const eur = { money: { currency: 'EUR' as const, fxRate: '0.92' } };
const usdNoRate = { money: { currency: 'USD' as const } };

describe('deriveDisplayRate', () => {
    it('takes the currency and rate off the first converted tour', () => {
        const out = deriveDisplayRate([{ money: null }, eur], 'USD');
        expect(out).toEqual({ currency: 'EUR', rate: 0.92, converted: true });
    });

    it('reports converted:false when NOTHING in the set carries money', () => {
        // REGRESSION. The hub hero derived its rate from Our Picks and the
        // comparison groups - both EDITORIAL and optional. A hub with tours but
        // neither yields no `money` at all, and the hero then printed the
        // SOURCE number under the shopper's symbol: a $120 tour reading
        // "From €120", as the first price on the page, while the trips grid
        // below showed the correctly converted figure.
        const out = deriveDisplayRate([{ money: null }], 'EUR');
        expect(out.converted).toBe(false);
        expect(out.rate).toBe(1);
        expect(out.currency).toBe('EUR');
    });

    it('reports converted:false for an empty set', () => {
        expect(deriveDisplayRate([], 'USD').converted).toBe(false);
    });

    it('still counts as converted when the rate is absent but money is present', () => {
        // A same-currency shopper gets a `money` object with no `fxRate`; the
        // identity rate is CORRECT there, and the figure must still print.
        const out = deriveDisplayRate([usdNoRate], 'EUR');
        expect(out).toEqual({ currency: 'USD', rate: 1, converted: true });
    });

    it('falls back to the shopper currency on an unusable currency code', () => {
        const out = deriveDisplayRate(
            [{ money: { currency: 'GBP' as never, fxRate: '0.8' } }],
            'USD',
        );
        expect(out.currency).toBe('USD');
        expect(out.converted).toBe(true);
    });

    it('treats an unparseable rate as the identity rather than NaN', () => {
        const out = deriveDisplayRate(
            [{ money: { currency: 'EUR' as const, fxRate: 'not a number' } }],
            'USD',
        );
        expect(out.rate).toBe(1);
    });

    describe('the failure this guards', () => {
        it('would print the source number under the wrong symbol', () => {
            // Demonstrates WHY callers must check `converted` rather than just
            // multiplying: a $120 source price, a EUR shopper, no rate found.
            const { currency, rate, converted } = deriveDisplayRate([], 'EUR');
            expect(converted).toBe(false);
            expect(formatPriceFrom(120 * rate, currency, 'en')).toBe('€120');
        });
    });
});
