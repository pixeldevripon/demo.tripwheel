'use client';

import { useBookingStore } from '@/hooks/tours/use-booking';
import {
    checkTourDepartures,
    getTourCalendar,
    type CalendarDay,
} from '@/lib/api/availability';
import { toDateParam } from '@/lib/checkout/checkout';
import type { CalendarDayState } from '@/lib/stores/booking-store';
import type { BookingSlot } from '@/lib/tours/booking';
import { useEffect } from 'react';

/** How far ahead to load the month calendar (covers the nightly 364-day horizon). */
const CALENDAR_HORIZON_DAYS = 365;

/**
 * Keeps the booking store's live availability in sync with the backend. Mounted
 * once inside the card; a no-op in design/demo mode (no `tourId`).
 *
 *  - On mount it fetches the whole bookable horizon from `/availability/calendar`
 *    in one call and writes the per-day open/sold-out/closed map.
 *  - Whenever the picked date changes it fetches that date's bookable departures
 *    from `/availability/check` and writes the real slots (with `remaining`).
 *
 * Both reads fail open (an errored fetch leaves the calendar unrestricted / the
 * day's slots empty) and abort in flight when the card unmounts or the date
 * changes, so a stale response never clobbers a newer selection.
 */
export function useAvailabilitySync(): void {
    const tourId = useBookingStore(s => s.tourId);
    const selectedDate = useBookingStore(s => s.selectedDate);
    const setCalendarDays = useBookingStore(s => s.setCalendarDays);
    const setCalendarLoading = useBookingStore(s => s.setCalendarLoading);
    const setDaySlots = useBookingStore(s => s.setDaySlots);
    const setSlotsLoading = useBookingStore(s => s.setSlotsLoading);

    // Month calendar: one fetch over the whole bookable horizon on mount.
    useEffect(() => {
        if (!tourId) return;
        const controller = new AbortController();
        const now = new Date();
        const from = toDateParam(now);
        const to = toDateParam(
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + CALENDAR_HORIZON_DAYS
            )
        );
        setCalendarLoading(true);
        getTourCalendar(tourId, from, to, controller.signal)
            .then((days: CalendarDay[]) => {
                const map: Record<string, CalendarDayState> = {};
                for (const d of days) {
                    map[d.date] = {
                        available: d.available,
                        status: d.status,
                        remaining: d.remaining,
                        closureReason: d.closureReason,
                    };
                }
                setCalendarDays(map);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                // Fail open: an empty map leaves every future day selectable
                // rather than blanking the calendar on a transient error. The
                // `failed` flag marks it as such - an empty map is otherwise
                // indistinguishable from a genuinely sold-out tour, and the
                // dead-end recovery must not fire on a network blip.
                setCalendarDays({}, true);
            });
        return () => controller.abort();
    }, [tourId, setCalendarDays, setCalendarLoading]);

    // Per-date slots: refetch whenever the picked date changes.
    const dateParam = selectedDate ? toDateParam(selectedDate) : null;
    useEffect(() => {
        if (!tourId || !dateParam) return;
        const controller = new AbortController();
        setSlotsLoading(true);
        checkTourDepartures(tourId, dateParam, dateParam, controller.signal)
            .then(deps => {
                const slots: BookingSlot[] = deps.map(d => ({
                    departureId: d.id,
                    time: d.startTime,
                    status: 'available',
                    // Disclosed hint for the badge (withheld above the threshold)...
                    remaining: d.remaining,
                    // ...but the true seats left always caps the party.
                    seatsLeft: Math.max(0, d.capacity - d.bookedCount),
                }));
                setDaySlots(slots);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setDaySlots([]);
            });
        return () => controller.abort();
    }, [tourId, dateParam, setDaySlots, setSlotsLoading]);
}
