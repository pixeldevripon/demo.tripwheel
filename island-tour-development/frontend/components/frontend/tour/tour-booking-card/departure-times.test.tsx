import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookingStoreProvider } from '@/contexts/booking-context';
import en from '@/lib/i18n/dictionaries/en.json';
import {
    DUMMY_BOOKING_DATA,
    type BookingSlot,
    type TourBookingDict,
} from '@/lib/tours/booking';
import { DepartureTimes } from './departure-times';

/**
 * Pastel #58 · the departure-time chips.
 *
 * "This tour has one departure, so there should be no chip at all. The row only
 * appears on tours with more than one." Every seeded tour on this platform
 * currently has exactly one departure, so the row renders nowhere locally - and
 * a rule you cannot see is a rule that quietly rots. These tests are what keep
 * the multi-departure half honest until a tour with two exists.
 */
const dict = en.destination.tour.booking as unknown as TourBookingDict;

/** The card, with a date already chosen so the chip row is past its own gate. */
function renderSlots(slots: BookingSlot[]) {
    return render(
        <BookingStoreProvider
            dict={dict}
            data={{ ...DUMMY_BOOKING_DATA, slots }}
            initialDate={`${new Date().getFullYear() + 2}-08-14`}>
            <DepartureTimes />
        </BookingStoreProvider>
    );
}

const AT_08 = { time: '08:00', status: 'available', remaining: null } as const;
const AT_13 = { time: '13:00', status: 'available', remaining: null } as const;
const SOLD_16 = { time: '16:00', status: 'sold_out', remaining: 0 } as const;

describe('a tour with one departure', () => {
    it('shows no chip row at all', () => {
        renderSlots([AT_08]);
        expect(screen.queryByText('Departure time')).not.toBeInTheDocument();
        expect(screen.queryByText('8:00 AM')).not.toBeInTheDocument();
    });

    it('shows nothing for a lone sold-out departure either', () => {
        renderSlots([SOLD_16]);
        expect(screen.queryByText('Departure time')).not.toBeInTheDocument();
    });
});

describe('a tour with more than one', () => {
    it('shows the row under its heading', () => {
        renderSlots([AT_08, AT_13]);
        expect(screen.getByText('Departure time')).toBeInTheDocument();
        expect(screen.getByText('8:00 AM')).toBeInTheDocument();
        expect(screen.getByText('1:00 PM')).toBeInTheDocument();
    });

    it('shows an open chip as the time alone', () => {
        renderSlots([AT_08, AT_13]);
        // No "Available" under a bookable chip, and no "Selected" under the
        // chosen one - selection is the orange border and fill.
        expect(screen.queryByText('Available')).not.toBeInTheDocument();
        expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    });

    it('keeps the sub-line for capacity, and only for capacity', () => {
        renderSlots([AT_08, AT_13, SOLD_16]);
        expect(screen.getByText('Sold out')).toBeInTheDocument();
    });

    it('still shows the row when the second departure is the sold-out one', () => {
        // The sold-out chip is worth saying - mck-15 §3 draws exactly this -
        // and the row appearing is what makes the open chip clickable.
        renderSlots([AT_08, SOLD_16]);
        expect(screen.getByText('Departure time')).toBeInTheDocument();
        expect(screen.getByText('Sold out')).toBeInTheDocument();
    });

    it('leaves a sold-out chip unpickable', () => {
        renderSlots([AT_08, AT_13, SOLD_16]);
        expect(
            screen.getByRole('button', { name: /4:00 PM/ })
        ).toBeDisabled();
    });

    it('never withholds a real choice by pre-picking one', () => {
        renderSlots([AT_08, AT_13]);
        const chips = screen
            .getAllByRole('button')
            .filter(b => /AM|PM/.test(b.textContent ?? ''));
        expect(chips).toHaveLength(2);
        expect(chips.every(c => !c.className.includes('bg-it-primary-subtle')))
            .toBe(true);
    });
});
