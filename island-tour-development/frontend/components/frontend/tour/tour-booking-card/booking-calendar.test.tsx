import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import {
    BookingStoreProvider,
    useBookingStoreApi,
} from '@/contexts/booking-context';
import { toDateParam } from '@/lib/checkout/checkout';
import en from '@/lib/i18n/dictionaries/en.json';
import type { CalendarDayState } from '@/lib/stores/booking-store';
import { DUMMY_BOOKING_DATA, type TourBookingDict } from '@/lib/tours/booking';
import { BookingCalendar } from './booking-calendar';

/**
 * Pastel #79 · one tooltip per date, not two.
 *
 * The unbookable-day hint was written twice onto the same cell: once as the
 * styled bubble above it, and once as a `title` attribute, which the browser
 * drew as its own plain tooltip BELOW it. Both were visible at the same time on
 * every hovered date - "Sold out" in two designs at once.
 *
 * The `title` is gone and the bubble stays. These tests hold both halves of
 * that: the hint still reaches a mouse (the bubble) and a screen reader (the
 * `aria-label`), and NO cell carries a `title` for the browser to draw. The
 * last one is the regression guard - `title` is invisible to a text query, so
 * only an attribute assertion can see it come back.
 */

const dict = en.destination.tour.booking as unknown as TourBookingDict;

/**
 * A month that is wholly in the future, so every day in the view is past the
 * `isPast` floor whatever today is - and one that the calendar will actually
 * open on, since it auto-advances to the first available day's month.
 */
const NEXT_MONTH = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
})();

const dayKey = (dayOfMonth: number) =>
    toDateParam(
        new Date(NEXT_MONTH.getFullYear(), NEXT_MONTH.getMonth(), dayOfMonth)
    );

const OPEN_DAY = dayKey(9);
const SOLD_OUT_DAY = dayKey(10);
const NOT_RUNNING_DAY = dayKey(11);

const DAYS: Record<string, CalendarDayState> = {
    [OPEN_DAY]: { available: true, status: 'OPEN', remaining: null },
    [SOLD_OUT_DAY]: {
        available: false,
        status: 'CLOSED',
        remaining: 0,
        closureReason: 'SOLD_OUT',
    },
    [NOT_RUNNING_DAY]: {
        available: false,
        status: 'CLOSED',
        remaining: null,
        closureReason: 'NOT_RUNNING',
    },
};

/** Pushes the live day map in and opens the popover, as the sync hook would. */
function OpenLiveCalendar() {
    const store = useBookingStoreApi();
    useEffect(() => {
        store.getState().setCalendarDays(DAYS);
        store.getState().setCalendarOpen(true);
    }, [store]);
    return null;
}

/** The calendar in LIVE mode (`tourId` set) with the day map above loaded. */
function renderCalendar() {
    return render(
        <BookingStoreProvider
            dict={dict}
            data={DUMMY_BOOKING_DATA}
            locale='en'
            tourId='tour-1'>
            <BookingCalendar />
            <OpenLiveCalendar />
        </BookingStoreProvider>
    );
}

/** The day cell button, found by the number it shows. */
function dayCell(dayOfMonth: number) {
    return screen
        .getAllByRole('button')
        .find(b => b.textContent === String(dayOfMonth))!;
}

describe('an unbookable day', () => {
    it('carries no title attribute, so the browser draws no second tooltip', () => {
        renderCalendar();
        expect(dayCell(10)).not.toHaveAttribute('title');
        expect(dayCell(11)).not.toHaveAttribute('title');
    });

    it('shows the styled bubble on hover, and only that', () => {
        renderCalendar();
        const cell = dayCell(10);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        fireEvent.mouseOver(cell.parentElement!);

        const tip = screen.getByRole('tooltip');
        expect(tip).toHaveTextContent('Sold out');
        // One bubble, not one per cell.
        expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    });

    it('still tells a screen reader why, via the label rather than the title', () => {
        renderCalendar();
        expect(dayCell(10)).toHaveAccessibleName('10, Sold out');
        expect(dayCell(11)).toHaveAccessibleName('11, No departure');
    });
});

describe('the calendar as a whole', () => {
    it('leaves no title attribute anywhere in the popover', () => {
        const { baseElement } = renderCalendar();
        // Portalled to `document.body`, so the whole document is the popover's
        // neighbourhood - and nothing in it may hand the browser a tooltip.
        expect(baseElement.querySelectorAll('[title]')).toHaveLength(0);
    });

    it('leaves a bookable day unlabelled and untooltipped', () => {
        renderCalendar();
        const cell = dayCell(9);
        expect(cell).not.toHaveAttribute('title');
        expect(cell).toBeEnabled();

        fireEvent.mouseOver(cell.parentElement!);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
