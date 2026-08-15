import { addDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import {
    departureState,
    unitNoun,
    type CalendarDepartureState,
} from '@/components/common/departure-states';
import type { OverviewDeparture, WholeUnitType } from '@/types/trip';

/**
 * Shared pure helpers for the global availability calendar. Dates travel as
 * 'YYYY-MM-DD' strings end to end (the backend's tour-local convention);
 * Date objects appear only transiently for arithmetic, never in state.
 */

export type CalendarView = 'day' | 'week' | 'month';

export const dateToKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const keyToDate = (key: string) => parseISO(key);

/**
 * The fetch window for a view around an anchor date.
 *
 * Week is a ROLLING seven days that STARTS at the anchor - deliberately not
 * the ISO week (client review comment 7): a Monday-anchored grid opened on a
 * Thursday spends four of its seven columns on days that can no longer be
 * changed, which is most of an operational screen gone. The anchor is the
 * island's today on load and whatever the mini month picks after that, so
 * column one is always the day being worked on. This is the same today+6
 * horizon the agenda already uses.
 *
 * Month keeps the platform's Mon-Sun convention (AvailabilitySchedule.weekday
 * 0=Monday, and the per-tour month grid renders Mon..Sun) - the client asked
 * for the Month view and the mini month to stay exactly as they are.
 */
export function viewWindow(view: CalendarView, anchorKey: string): {
    from: string;
    days: number;
} {
    if (view === 'day') return { from: anchorKey, days: 1 };
    if (view === 'week') return { from: anchorKey, days: 7 };
    // Month: the six full Mon-Sun weeks covering the anchor's month.
    return {
        from: dateToKey(
            startOfWeek(startOfMonth(keyToDate(anchorKey)), {
                weekStartsOn: 1,
            }),
        ),
        days: 42,
    };
}

/** Step the anchor one unit forward/back for the active view. */
export function stepAnchor(
    view: CalendarView,
    anchorKey: string,
    dir: 1 | -1,
): string {
    const anchor = keyToDate(anchorKey);
    if (view === 'day') return dateToKey(addDays(anchor, dir));
    // A rolling week pages a whole week at a time, so the first column keeps
    // its weekday and the windows tile without gaps or overlap.
    if (view === 'week') return dateToKey(addDays(anchor, 7 * dir));
    // Month stepping anchors on the 1st so repeated clicks never skid on
    // short months (Jan 31 -> Feb 28 -> Mar 28).
    const first = startOfMonth(anchor);
    return dateToKey(
        new Date(first.getFullYear(), first.getMonth() + dir, 1),
    );
}

/** The toolbar's range label ("August 2026" / "Aug 3 - 9, 2026" / full day). */
export function rangeLabel(view: CalendarView, anchorKey: string): string {
    const anchor = keyToDate(anchorKey);
    // Short weekday AND short month - "Thursday, 30 July 2026" and even
    // "Sat, 1 August 2026" overflow the toolbar's fixed label width now that
    // it matches the sidebar column (founder 2026-07-31).
    if (view === 'day') return format(anchor, 'EEE, d MMM yyyy');
    if (view === 'week') {
        // The rolling window's own bounds - the label must name the seven days
        // actually on screen, not the ISO week they fall in.
        const end = addDays(anchor, 6);
        const sameMonth = anchor.getMonth() === end.getMonth();
        return sameMonth
            ? `${format(anchor, 'MMM d')} - ${format(end, 'd, yyyy')}`
            : `${format(anchor, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(anchor, 'MMMM yyyy');
}

/**
 * Effective chip state, via the SHARED vocabulary (MCK-16 change 9): one
 * derivation + one colour/label set for every dated surface, with cancelled
 * distinct from departed - see components/common/departure-states.ts.
 */
export function chipState(dep: OverviewDeparture): CalendarDepartureState {
    return departureState({
        status: dep.status,
        cutoffPassed: dep.cutoffPassed,
        hasClosure: !!dep.closure,
    });
}

/** "GMT-4" for the time-grid gutter corner, from an IANA zone. */
export function gmtLabel(timeZone: string | undefined): string {
    if (!timeZone) return '';
    try {
        const parts = new Intl.DateTimeFormat('en', {
            timeZone,
            timeZoneName: 'shortOffset',
        }).formatToParts(new Date());
        return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
        return '';
    }
}

/**
 * "3/12" seat chip text; unit charters say what one booking takes whole -
 * "Whole boat", never "Free" (MCK-16 change 11): on a screen where every
 * other number is seats sold, "Free" reads as no cost. Booked-ness shows
 * through the STATE, not the label.
 */
export function seatsLabel(
    dep: OverviewDeparture,
    wholeUnitType?: WholeUnitType | null,
): string {
    if (dep.pricingModel === 'UNIT') {
        return `Whole ${unitNoun(wholeUnitType)}`;
    }
    return `${dep.bookedCount}/${dep.capacity}`;
}
