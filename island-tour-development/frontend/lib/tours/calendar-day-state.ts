/**
 * What a single day in the booking calendar is, and how it should read.
 *
 * Four situations used to render as the same grey with one hover label saying
 * "Closed" for all of them (Pastel #58). They are not the same thing, and the
 * difference decides whether a traveller waits or moves on:
 *
 * | Day                              | Label        | Line through the date |
 * |----------------------------------|--------------|-----------------------|
 * | Trip is full                     | Sold out     | yes                   |
 * | Booking cutoff has passed        | Closed       | yes                   |
 * | Tour does not run that day       | No departure | no                    |
 *
 * The line carries a RULE, not a state: *there was a departure here and it can
 * no longer be had*. Sold out and past-cutoff both qualify; a day the trip never
 * runs does not, so it stays plain grey. That distinction is the one a traveller
 * can still read on a phone, where hover does not exist - which is why the line
 * has to carry it and the tooltip cannot.
 *
 * No React, no store: a pure mapping from the backend's per-day payload.
 */

/** The reason a day cannot be booked. `open` days carry no reason. */
export type CalendarDayReason = 'open' | 'sold_out' | 'closed' | 'no_departure';

/** Just enough of `CalendarDay` to classify it; null = absent from the payload. */
export interface CalendarDayInput {
    available: boolean;
    status: string;
}

/**
 * Classify one day. `day` is null when the date is absent from the calendar
 * payload, which is exactly how the backend says "no departures at all here" -
 * only days that HAVE departures are returned.
 */
export function calendarDayReason(
    day: CalendarDayInput | null | undefined
): CalendarDayReason {
    if (!day) return 'no_departure';
    if (day.available) return 'open';
    return day.status === 'SOLD_OUT' ? 'sold_out' : 'closed';
}

/**
 * Whether the date is struck through: there WAS a departure and it is gone.
 * A day the tour never runs is not struck - nothing was ever on sale.
 */
export function isStruckThrough(reason: CalendarDayReason): boolean {
    return reason === 'sold_out' || reason === 'closed';
}

/** The localized label for a day's reason, or null for a bookable one. */
export function calendarDayLabel(
    reason: CalendarDayReason,
    dict: {
        soldOut: string;
        calendarClosed: string;
        calendarNoDepartures: string;
    }
): string | null {
    switch (reason) {
        case 'sold_out':
            return dict.soldOut;
        case 'closed':
            return dict.calendarClosed;
        case 'no_departure':
            return dict.calendarNoDepartures;
        default:
            return null;
    }
}
