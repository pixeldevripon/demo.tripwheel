import { describe, expect, it } from 'vitest';

import {
    ALL_LOCALES,
    LOCALE_CURRENCY,
    type Locale,
} from '@/lib/constants/locales';

import { currencyFromCookie, storedCurrency } from './current';

/**
 * The locale -> currency matrix is a founder decision, not an implementation
 * detail, and it has already been changed once under a misreading ("the
 * European locales get EUR" - ES and PT are spoken mostly outside Europe, and
 * the South American visitors those locales actually serve think in dollars,
 * Pastel #30). Spelling every locale out here means a future edit has to state
 * its intent rather than quietly flip a row.
 */
describe('locale default currency (master §D.2 + Pastel #30)', () => {
    const EXPECTED: Record<Locale, 'EUR' | 'USD'> = {
        en: 'USD',
        es: 'USD',
        pt: 'USD',
        zh: 'USD',
        nl: 'EUR',
        de: 'EUR',
        fr: 'EUR',
    };

    it.each(Object.entries(EXPECTED))('%s defaults to %s', (locale, code) => {
        expect(LOCALE_CURRENCY[locale as Locale]).toBe(code);
    });

    it('covers every supported locale, so a new one cannot ship unpriced', () => {
        expect(Object.keys(LOCALE_CURRENCY).sort()).toEqual(
            [...ALL_LOCALES].sort(),
        );
    });

});

describe('currency precedence', () => {
    it('an explicit footer choice outranks the locale default', () => {
        // The whole point of ES/PT defaulting to USD is that it is only a
        // DEFAULT - a visitor who picks EUR keeps EUR.
        expect(currencyFromCookie('NEXT_CURRENCY=EUR', 'es')).toBe('EUR');
        expect(currencyFromCookie('NEXT_CURRENCY=EUR', 'pt')).toBe('EUR');
        expect(currencyFromCookie('NEXT_CURRENCY=USD', 'de')).toBe('USD');
    });

    it('with no cookie, the locale default applies - so switching locale switches currency', () => {
        expect(currencyFromCookie(undefined, 'es')).toBe('USD');
        expect(currencyFromCookie(undefined, 'pt')).toBe('USD');
        expect(currencyFromCookie('', 'de')).toBe('EUR');
        expect(currencyFromCookie(null, 'nl')).toBe('EUR');
    });

    it('a chosen currency survives a locale switch', () => {
        // es -> de would otherwise flip USD to EUR under the visitor.
        const chosen = 'NEXT_CURRENCY=USD';
        for (const locale of ALL_LOCALES) {
            expect(currencyFromCookie(chosen, locale)).toBe('USD');
        }
    });

    it('a corrupt cookie value is ignored, not trusted', () => {
        // `storedCurrency` must report "no choice" so the default can apply -
        // folding a default in there would make the two indistinguishable.
        expect(storedCurrency('NEXT_CURRENCY=GBP')).toBeUndefined();
        expect(currencyFromCookie('NEXT_CURRENCY=GBP', 'es')).toBe('USD');
        expect(currencyFromCookie('NEXT_CURRENCY=GBP', 'fr')).toBe('EUR');
    });
});
