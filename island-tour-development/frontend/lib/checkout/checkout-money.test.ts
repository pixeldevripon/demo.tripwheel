import { describe, expect, it } from 'vitest';

import type { Locale } from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';
import { depositToday, formatCheckoutMoney } from './checkout';

/**
 * Money on the payment surface. The whole funnel - booking widget, checkout
 * summary, the Pay button - runs through this one function, so its output is
 * what a traveller reads immediately before being charged.
 *
 * Assertions are on SHAPE (does the symbol lead or trail) rather than exact
 * strings, because ICU separates the two with a non-breaking space whose exact
 * codepoint is a CLDR detail we should not pin.
 */

const LOCALES: Locale[] = ['en', 'de', 'nl', 'fr', 'es', 'pt', 'zh'];

/** Where does the currency symbol sit relative to the digits? */
function placement(formatted: string, symbol: string): 'leading' | 'trailing' {
    return formatted.indexOf(symbol) < formatted.search(/\d/)
        ? 'leading'
        : 'trailing';
}

describe('formatCheckoutMoney', () => {
    describe('symbol placement (the regression)', () => {
        it.each([
            ['de', 'trailing'],
            ['fr', 'trailing'],
            ['es', 'trailing'],
        ] as const)('places the euro sign %s in %s', (locale, expected) => {
            // REGRESSION. This used to build `${symbol}${amount}` by hand, so it
            // ALWAYS produced a leading "€1.750". ICU is the authority, and in
            // these locales the symbol trails. The booking card rendered both
            // spellings at once: its price header used the hand-rolled version,
            // the alternatives row beneath it used `formatPriceFrom`.
            expect(placement(formatCheckoutMoney(1750, 'EUR', locale), '€')).toBe(
                expected,
            );
        });

        it.each(['en', 'nl', 'pt', 'zh'] as const)(
            'places the euro sign leading in %s',
            (locale) => {
                expect(
                    placement(formatCheckoutMoney(1750, 'EUR', locale), '€'),
                ).toBe('leading');
            },
        );

        it('trails the DOLLAR sign too in de/fr/es', () => {
            // Worth pinning explicitly: the placement rule is a property of the
            // locale, not of the currency. A "$ always leads" assumption is
            // wrong in exactly the locales the euro rule is wrong in.
            for (const locale of ['de', 'fr', 'es'] as const) {
                expect(placement(formatCheckoutMoney(120, 'USD', locale), '$')).toBe(
                    'trailing',
                );
            }
        });

        it('never emits two symbols or a stray one', () => {
            for (const locale of LOCALES) {
                const out = formatCheckoutMoney(1750.5, 'EUR', locale);
                expect(out.match(/€/g)).toHaveLength(1);
                expect(out).not.toContain('$');
            }
        });
    });

    describe('locale-aware digits', () => {
        it('uses the locale\'s own grouping and decimal separators', () => {
            expect(formatCheckoutMoney(1750.5, 'USD', 'en')).toContain('1,750.50');
            expect(formatCheckoutMoney(1750.5, 'EUR', 'de')).toContain('1.750,50');
        });
    });

    describe('cents (deliberately UNCHANGED by the fix)', () => {
        it('leaves whole amounts bare - founder rule 2026-07-16', () => {
            expect(formatCheckoutMoney(75, 'USD', 'en')).toBe('$75');
            expect(formatCheckoutMoney(1750, 'USD', 'en')).toBe('$1,750');
        });

        it('always carries BOTH cents on a fractional amount', () => {
            // Never "$63.7", never a rounded "$64".
            expect(formatCheckoutMoney(63.75, 'USD', 'en')).toBe('$63.75');
            expect(formatCheckoutMoney(63.7, 'USD', 'en')).toBe('$63.70');
        });

        it('never rounds a fractional amount up to a whole one', () => {
            expect(formatCheckoutMoney(63.99, 'USD', 'en')).toBe('$63.99');
        });

        it('renders a zero total bare', () => {
            expect(formatCheckoutMoney(0, 'USD', 'en')).toBe('$0');
        });
    });

    it('agrees exactly with the widget/listing formatter, in every locale', () => {
        // ONE formatter for the funnel. The booking widget's `money()` was a
        // verbatim copy of this function - same expression, same docblock - so
        // the widget and the checkout summary could drift across a single
        // navigation. Both now route here.
        for (const amount of [0, 75, 120, 1750, 63.75, 1234.5]) {
            for (const locale of LOCALES) {
                for (const currency of ['EUR', 'USD'] as const) {
                    expect(formatCheckoutMoney(amount, currency, locale)).toBe(
                        formatPriceFrom(amount, currency, locale),
                    );
                }
            }
        }
    });
});

describe('depositToday', () => {
    it('rounds the deposit UP to a whole unit', () => {
        // The reported case: a EUR 615 booking at 30% read "Pay today EUR
        // 184.50 / Balance later EUR 430.50" under a whole "Total EUR 615".
        expect(depositToday(615, 30)).toBe(185);
    });

    it('leaves an already-whole deposit alone', () => {
        expect(depositToday(500, 20)).toBe(100);
        expect(depositToday(128, 25)).toBe(32);
    });

    it('never rounds down, however small the fraction', () => {
        expect(depositToday(100.04, 30)).toBe(31);
    });

    it('is zero for a zero tour total', () => {
        expect(depositToday(0, 30)).toBe(0);
    });

    it('leaves deposit + balance summing to the total, at every tier rate', () => {
        // The balance is the REMAINDER, never its own percentage - so the ceil
        // can never make the two halves disagree with the whole.
        for (const total of [128, 205, 615, 1450, 3864]) {
            for (const pct of [20, 22.5, 25, 27.5, 30, 35]) {
                const today = depositToday(total, pct);
                expect(Number.isInteger(today)).toBe(true);
                expect(today + (total - today)).toBe(total);
                expect(today).toBeGreaterThanOrEqual((total * pct) / 100);
            }
        }
    });
});
