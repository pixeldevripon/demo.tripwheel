import { addDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { OverviewDeparture } from '@/types/trip';

/**
 * Shared pure helpers for the global availability calendar. Dates travel as
 * 'YYYY-MM-DD' strings end to end (the backend's tour-local convention);
 * Date objects appear only transiently for arithmetic, never in state.
 */

export type CalendarView = 'day' | 'week' | 'month';

export const dateToKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const keyToDate = (key: string) => parseISO(key);

/**
 * The fetch window for a view around an anchor date. Weeks start Monday -
 * the platform convention (AvailabilitySchedule.weekday 0=Monday, and the
 * per-tour month grid renders Mon..Sun).
 */
export function viewWindow(view: CalendarView, anchorKey: string): {
    from: string;
    days: number;
} {
    const anchor = keyToDate(anchorKey);
    if (view === 'day') return { from: anchorKey, days: 1 };
    if (view === 'week') {
        return {
            from: dateToKey(startOfWeek(anchor, { weekStartsOn: 1 })),
            days: 7,
        };
    }
    // Month: the six full Mon-Sun weeks covering the anchor's month.
    return {
        from: dateToKey(startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })),
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
        const start = startOfWeek(anchor, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        const sameMonth = start.getMonth() === end.getMonth();
        return sameMonth
            ? `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`
            : `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(anchor, 'MMMM yyyy');
}

/**
 * Effective chip state: the four live statuses plus "departed" (cutoff passed
 * on a still-OPEN row - the boats left, nothing is wrong). Matches the agenda
 * legend exactly: green open · violet sold out · red closed · grey
 * departed/cancelled.
 */
export type ChipState = 'open' | 'soldOut' | 'closed' | 'past';

export function chipState(dep: OverviewDeparture): ChipState {
    if (dep.status === 'CANCELLED') return 'past';
    if (dep.status === 'SOLD_OUT') return 'soldOut';
    // A closure row means someone stop-sold it; a bare CLOSED with the cutoff
    // passed is just "departed".
    if (dep.status === 'CLOSED') {
        return dep.closure ? 'closed' : dep.cutoffPassed ? 'past' : 'closed';
    }
    return dep.cutoffPassed ? 'past' : 'open';
}

/** Chip surface classes per state (bg + text; the dot uses DOT_CLASS). */
export const CHIP_CLASS: Record<ChipState, string> = {
    open: 'bg-success-subtle text-success-fg hover:bg-success-subtle/70',
    soldOut: 'bg-info-subtle text-info-fg hover:bg-info-subtle/70',
    closed: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
    past: 'bg-muted/60 text-muted-foreground hover:bg-muted',
};

export const DOT_CLASS: Record<ChipState, string> = {
    open: 'bg-success-fg',
    soldOut: 'bg-info-fg',
    closed: 'bg-destructive',
    past: 'bg-muted-foreground/50',
};

export const STATE_LABEL: Record<ChipState, string> = {
    open: 'Open',
    soldOut: 'Sold out',
    closed: 'Closed by you',
    past: 'Departed or cancelled',
};

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

/** "3/12" seat chip text; unit charters speak guests, never seat math. */
export function seatsLabel(dep: OverviewDeparture): string {
    if (dep.pricingModel === 'UNIT') {
        return dep.bookedCount > 0 ? 'Booked' : 'Free';
    }
    return `${dep.bookedCount}/${dep.capacity}`;
}
