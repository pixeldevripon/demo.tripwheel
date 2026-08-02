import { describe, expect, it } from 'vitest';

import { formatMoney } from '@/lib/currency/current';
import {
    bookingDateTimeLine,
    bookingMetaLine,
    durationLabel,
    formatDay,
    formatDayShort,
    formatDeadline,
    lookupLabel,
    mapsUrl,
    maskEmail,
    money,
    onArrivalLine,
    partyLabel,
    payBalanceLine,
    paymentMethodLabel,
    toCurrency,
} from './traveller-format';

/**
 * The pure display layer behind every traveller surface - booking cards, the
 * next-trip hero, the payments ledger and the printable receipt. Being pure is
 * exactly why these are worth pinning: a change here shows up on four screens
 * at once, and the receipt is a financial document.
 */

describe('money', () => {
    it('always carries cents on a whole amount', () => {
        // REGRESSION. This used to delegate to `formatPriceFrom`, the LISTING
        // "From" formatter, which renders whole amounts bare. A booking total
        // read "$1,750" in the account area and "$1,750.00" on the thank-you
        // page one click away - and the receipt silently dropped cents.
        expect(money(1750, 'USD', 'en')).toBe('$1,750.00');
        expect(money('120', 'EUR', 'en')).toBe('€120.00');
    });

    it('renders fractional amounts unchanged', () => {
        expect(money('63.75', 'USD', 'en')).toBe('$63.75');
    });

    it('groups thousands', () => {
        expect(money(1750, 'USD', 'en')).toContain(',');
    });

    it('agrees exactly with the formatter every other money surface uses', () => {
        // The TYP, checkout and the cancel page all call `formatMoney`. This
        // equivalence IS the invariant - if it ever fails, two screens showing
        // the same booking disagree about its price.
        for (const amount of [0, 5, 120, 1750, 63.75, 1234.5]) {
            expect(money(amount, 'USD', 'en')).toBe(
                formatMoney(amount, 'USD', 'en'),
            );
        }
    });

    it('formats in the row\'s own currency, not a global setting', () => {
        expect(money(100, 'EUR', 'en')).toBe('€100.00');
        expect(money(100, 'USD', 'en')).toBe('$100.00');
    });

    it('falls back to a zero total rather than NaN on unparseable input', () => {
        expect(money('not a number', 'USD', 'en')).toBe('$0.00');
    });
});

describe('toCurrency', () => {
    it('narrows USD, and treats everything else as EUR', () => {
        expect(toCurrency('USD')).toBe('USD');
        expect(toCurrency('EUR')).toBe('EUR');
        expect(toCurrency(null)).toBe('EUR');
        expect(toCurrency(undefined)).toBe('EUR');
        expect(toCurrency('GBP')).toBe('EUR');
    });
});

describe('formatDay', () => {
    it('pins a date-only value to UTC so a negative-offset browser cannot show the day before', () => {
        // ICU emits a comma after the weekday; the docblock's "Fri 14 Aug 2026"
        // is shorthand, not the literal output.
        expect(formatDay('2026-08-14', 'en')).toBe('Fri, 14 Aug 2026');
    });

    it('renders `en` day-first, matching the thank-you page', () => {
        // Without the en -> en-GB remap the SAME booking reads "Aug 14, 2026"
        // here and "14 Aug 2026" on its TYP.
        expect(formatDay('2026-08-14', 'en')).not.toMatch(/^Aug/);
    });

    it('carries the weekday', () => {
        expect(formatDay('2026-08-14', 'en')).toMatch(/^Fri/);
    });

    it('returns an empty string for missing or unparseable input', () => {
        expect(formatDay(null, 'en')).toBe('');
        expect(formatDay(undefined, 'en')).toBe('');
        expect(formatDay('', 'en')).toBe('');
        expect(formatDay('not a date', 'en')).toBe('');
    });

    it('handles a full ISO instant as well as a wall-clock date', () => {
        expect(formatDay('2026-08-14T09:30:00Z', 'en')).toBe('Fri, 14 Aug 2026');
    });
});

describe('formatDeadline', () => {
    it('reads the island wall clock, not the browser\'s', () => {
        // The backend serializes local time with a UTC label on purpose, so
        // reading it back in UTC yields the island's own clock.
        expect(formatDeadline('2026-08-12T14:00:00Z', 'en')).toBe(
            'Wed 12 Aug, 14:00',
        );
    });

    it('uses a 24h clock regardless of locale', () => {
        expect(formatDeadline('2026-08-12T23:30:00Z', 'en')).toContain('23:30');
        expect(formatDeadline('2026-08-12T00:05:00Z', 'en')).toContain('00:05');
    });

    it('returns an empty string for missing input', () => {
        expect(formatDeadline(null, 'en')).toBe('');
    });
});

describe('formatDayShort', () => {
    it('drops the year', () => {
        expect(formatDayShort('2026-08-14', 'en')).toBe('Fri 14 Aug');
    });

    it('returns an empty string for missing input', () => {
        expect(formatDayShort(null, 'en')).toBe('');
    });
});

describe('partyLabel', () => {
    const dict = { guestsOne: '1 traveler', guests: '{count} travelers' };

    it('uses a real singular', () => {
        expect(partyLabel(1, dict)).toBe('1 traveler');
    });

    it('interpolates the count for a group', () => {
        expect(partyLabel(4, dict)).toBe('4 travelers');
    });

    it('uses the plural for zero', () => {
        expect(partyLabel(0, dict)).toBe('0 travelers');
    });
});

describe('durationLabel', () => {
    it.each([
        [45, '45m'],
        [60, '1h'],
        [90, '1h 30m'],
        [480, '8h'],
    ])('renders %i minutes as %s', (minutes, expected) => {
        expect(durationLabel(minutes)).toBe(expected);
    });

    it('renders nothing when there is no usable duration', () => {
        expect(durationLabel(null)).toBe('');
        expect(durationLabel(undefined)).toBe('');
        expect(durationLabel(0)).toBe('');
        expect(durationLabel(-30)).toBe('');
    });
});

describe('maskEmail', () => {
    it('keeps the first and last local characters only', () => {
        expect(maskEmail('deveripon@gmail.com')).toBe('d•••••n@gmail.com');
    });

    it('handles a single-character local part without leaking it twice', () => {
        expect(maskEmail('a@example.com')).toBe('a•••••@example.com');
    });

    it('returns a value with no @ unchanged rather than mangling it', () => {
        expect(maskEmail('not-an-email')).toBe('not-an-email');
    });
});

describe('mapsUrl', () => {
    it('prefers coordinates - an address is ambiguous across islands', () => {
        expect(mapsUrl(12.1, -68.9, 'Beach Road')).toBe(
            'https://www.google.com/maps/search/?api=1&query=12.1%2C-68.9',
        );
    });

    it('falls back to the address when coordinates are missing', () => {
        expect(mapsUrl(null, null, 'Beach Road')).toContain('Beach%20Road');
    });

    it('needs BOTH coordinates before it trusts them', () => {
        expect(mapsUrl(12.1, null, 'Beach Road')).toContain('Beach%20Road');
    });

    it('escapes the query rather than building a broken URL', () => {
        expect(mapsUrl(null, null, 'Pier & Dock')).toContain('Pier%20%26%20Dock');
    });

    it('returns null when there is nothing to point at', () => {
        expect(mapsUrl(null, null, null)).toBeNull();
        expect(mapsUrl(null, null, '   ')).toBeNull();
    });
});

describe('paymentMethodLabel', () => {
    it('renders brand and last four', () => {
        expect(paymentMethodLabel('visa', '4242', 'card')).toBe('Visa ·· 4242');
    });

    it('drops the separator when there is no last four', () => {
        // REGRESSION. The receipt used to build this itself and rendered
        // "Visa ··" - its `.trim()` stripped the trailing space but not the
        // separator - while the ledger it is linked from rendered "Visa".
        expect(paymentMethodLabel('visa', null, 'card')).toBe('Visa');
        expect(paymentMethodLabel('visa', '', 'card')).toBe('Visa');
    });

    it('falls back to the method type when there is no card brand', () => {
        expect(paymentMethodLabel(null, null, 'ideal')).toBe('Ideal');
    });

    it('prefers the brand over the type', () => {
        expect(paymentMethodLabel('mastercard', '1234', 'card')).toBe(
            'Mastercard ·· 1234',
        );
    });

    it('returns null when there is nothing to show', () => {
        expect(paymentMethodLabel(null, null, null)).toBeNull();
        expect(paymentMethodLabel(undefined, undefined, undefined)).toBeNull();
    });

    it('never leaves a dangling separator, whatever the inputs', () => {
        for (const brand of ['visa', null]) {
            for (const last4 of ['4242', null, '']) {
                const label = paymentMethodLabel(brand, last4, 'card');
                expect(label?.trimEnd().endsWith('··')).not.toBe(true);
            }
        }
    });
});

describe('lookupLabel', () => {
    const dict = { CONFIRMED: 'Confirmed', PENDING: 'Pending' };

    it('resolves a known key', () => {
        expect(lookupLabel(dict, 'CONFIRMED')).toBe('Confirmed');
    });

    it('falls back to the raw key for a status this build has no copy for', () => {
        // Honest and debuggable beats an empty chip that just looks broken.
        expect(lookupLabel(dict, 'REDEEMED')).toBe('REDEEMED');
    });
});

describe('bookingDateTimeLine', () => {
    it('joins date and start time', () => {
        expect(
            bookingDateTimeLine(
                { localDate: '2026-08-14', startTime: '09:00' },
                'en',
            ),
        ).toBe('Fri, 14 Aug 2026 · 09:00');
    });

    it('omits the separator when there is no start time', () => {
        expect(
            bookingDateTimeLine({ localDate: '2026-08-14', startTime: null }, 'en'),
        ).toBe('Fri, 14 Aug 2026');
    });
});

describe('bookingMetaLine', () => {
    const dict = { guestsOne: '1 traveler', guests: '{count} travelers' };
    const booking = {
        localDate: '2026-08-14',
        startTime: '09:00',
        partySize: 2,
        destinationName: 'Curacao',
    };

    it('composes date · time · party · destination', () => {
        // ONE definition shared by the list card and the next-trip hero, which
        // render the SAME booking one above the other on the account page.
        expect(bookingMetaLine(booking, dict, 'en')).toBe(
            'Fri, 14 Aug 2026 · 09:00 · 2 travelers · Curacao',
        );
    });

    it('drops the party segment when the size is zero', () => {
        expect(bookingMetaLine({ ...booking, partySize: 0 }, dict, 'en')).toBe(
            'Fri, 14 Aug 2026 · 09:00 · Curacao',
        );
    });

    it('drops a missing destination without leaving a dangling separator', () => {
        const line = bookingMetaLine(
            { ...booking, destinationName: null },
            dict,
            'en',
        );
        expect(line).toBe('Fri, 14 Aug 2026 · 09:00 · 2 travelers');
        expect(line.endsWith('·')).toBe(false);
    });

    it('uses the real singular for one traveller', () => {
        expect(bookingMetaLine({ ...booking, partySize: 1 }, dict, 'en')).toContain(
            '1 traveler ·',
        );
    });
});

describe('onArrivalLine', () => {
    const dict = { payOnArrivalCash: 'Cash only', payOnArrivalCard: 'Cash or card' };

    it('says cash-only for CASH_ONLY', () => {
        expect(onArrivalLine('CASH_ONLY', dict)).toBe('Cash only');
    });

    it('falls back to cash-or-card for anything else, including null', () => {
        // Defaulting the OTHER way would promise a card terminal that may not
        // exist on the beach.
        expect(onArrivalLine('CASH_OR_CARD', dict)).toBe('Cash or card');
        expect(onArrivalLine(null, dict)).toBe('Cash or card');
        expect(onArrivalLine(undefined, dict)).toBe('Cash or card');
    });
});

describe('payBalanceLine', () => {
    const dict = {
        payLinkBefore: 'Pay {operator} by {deadline}',
        payLinkAfter: 'Pay {amount} to {operator}',
    };
    const base = {
        balance: '$120.00',
        operatorName: 'Blue Bay Tours',
        deadline: '2026-08-12T14:00:00Z',
        windowOpen: true,
    };

    it('names the deadline while the window is open', () => {
        expect(payBalanceLine(base, dict, 'en')).toBe(
            'Pay Blue Bay Tours by Wed 12 Aug, 14:00',
        );
    });

    it('names the amount once the window has closed', () => {
        expect(payBalanceLine({ ...base, windowOpen: false }, dict, 'en')).toBe(
            'Pay $120.00 to Blue Bay Tours',
        );
    });

    it('uses the after-copy when there is no deadline at all', () => {
        // Never render a sentence with an empty "{deadline}" hole in it.
        const line = payBalanceLine({ ...base, deadline: null }, dict, 'en');
        expect(line).toBe('Pay $120.00 to Blue Bay Tours');
        expect(line).not.toContain('{');
    });
});
