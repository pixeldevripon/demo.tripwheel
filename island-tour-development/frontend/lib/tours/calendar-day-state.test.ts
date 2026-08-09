import { describe, expect, it } from 'vitest';
import {
    calendarDayLabel,
    calendarDayReason,
    isStruckThrough,
} from './calendar-day-state';

/**
 * Pastel #58 · the calendar's four situations, which used to be one grey with
 * one hover label saying "Closed" for all of them.
 *
 * The line through a date carries a RULE - there was a departure here and it can
 * no longer be had - not a state. That is the distinction a traveller can still
 * read on a phone, where hover does not exist, so it is the one worth locking.
 */

const dict = {
    soldOut: 'Sold out',
    calendarClosed: 'Closed',
    calendarNoDepartures: 'No departure',
};

describe('calendarDayReason', () => {
    it('reads a day absent from the payload as no departure', () => {
        // The backend only returns days that HAVE departures, so absence is the
        // signal - not an error, and not the same thing as sold out.
        expect(calendarDayReason(undefined)).toBe('no_departure');
        expect(calendarDayReason(null)).toBe('no_departure');
    });

    it('reads a full day as sold out', () => {
        expect(
            calendarDayReason({ available: false, status: 'SOLD_OUT' })
        ).toBe('sold_out');
    });

    it('reads a day past its cutoff as closed', () => {
        expect(calendarDayReason({ available: false, status: 'CLOSED' })).toBe(
            'closed'
        );
    });

    it('reads a bookable day as open', () => {
        expect(calendarDayReason({ available: true, status: 'OPEN' })).toBe(
            'open'
        );
    });
});

describe('isStruckThrough', () => {
    it('strikes the two days that HAD a departure and lost it', () => {
        expect(isStruckThrough('sold_out')).toBe(true);
        expect(isStruckThrough('closed')).toBe(true);
    });

    it('leaves a day the tour never runs unstruck', () => {
        // Nothing was ever on sale, so nothing was lost.
        expect(isStruckThrough('no_departure')).toBe(false);
    });

    it('leaves a bookable day unstruck', () => {
        expect(isStruckThrough('open')).toBe(false);
    });
});

describe('calendarDayLabel', () => {
    it('gives each unbookable state its own words', () => {
        // Three labels, not one. "Closed" keeps the meaning the spec gives it -
        // past the booking cutoff - and is not a catch-all.
        expect(calendarDayLabel('sold_out', dict)).toBe('Sold out');
        expect(calendarDayLabel('closed', dict)).toBe('Closed');
        expect(calendarDayLabel('no_departure', dict)).toBe('No departure');
    });

    it('labels a bookable day with nothing at all', () => {
        expect(calendarDayLabel('open', dict)).toBeNull();
    });
});
