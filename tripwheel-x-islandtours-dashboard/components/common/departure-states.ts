import type { DepartureStatus, WholeUnitType } from '@/types/trip';

/**
 * ONE departure-state vocabulary for every dated surface (MCK-16 change 9,
 * availability review §3.5): the global calendar, the per-tour Schedule
 * calendar and the agenda must render identical words and colours for the
 * same departure - the two surfaces had already drifted apart once.
 *
 * The decided set: Open teal outline · Sold out violet solid · Closed grey
 * struck · Cancelled red outline · past simply fades. Red belongs to
 * cancellation alone (the one state that moves money) - a routine closure is
 * never red. Departed and cancelled are NOT one state.
 */
export type CalendarDepartureState =
    | 'open'
    | 'soldOut'
    | 'closed'
    | 'cancelled'
    | 'past';

/**
 * Live-state derivation. `hasClosure` distinguishes a stop-sold departure
 * (someone acted - show who and why) from a bare CLOSED whose cutoff passed
 * (the boat left, nothing is wrong).
 */
export function departureState({
    status,
    cutoffPassed = false,
    hasClosure = false,
}: {
    status: DepartureStatus;
    cutoffPassed?: boolean;
    hasClosure?: boolean;
}): CalendarDepartureState {
    if (status === 'CANCELLED') return 'cancelled';
    if (status === 'SOLD_OUT') return 'soldOut';
    if (status === 'CLOSED') {
        return hasClosure ? 'closed' : cutoffPassed ? 'past' : 'closed';
    }
    return cutoffPassed ? 'past' : 'open';
}

export const DEPARTURE_STATE_LABEL: Record<CalendarDepartureState, string> = {
    open: 'Open',
    soldOut: 'Sold out',
    // Plain "Closed" - the closer might be a teammate or Island Tours; the
    // audit line names them. "Closed by you" was retired with MCK-16.
    closed: 'Closed',
    cancelled: 'Cancelled',
    past: 'Departed',
};

/** Chip/pill surfaces per state - the decided colours, tokens only. */
export const DEPARTURE_CHIP_CLASS: Record<CalendarDepartureState, string> = {
    open: 'border border-cal-open-border bg-cal-open-subtle text-cal-open-fg hover:bg-cal-open-subtle/70',
    soldOut:
        'border border-transparent bg-cal-sold-solid text-white hover:bg-cal-sold-solid/90',
    closed: 'border border-transparent bg-muted text-muted-foreground line-through hover:bg-muted/80',
    cancelled:
        'border border-danger-border bg-transparent text-danger-fg hover:bg-danger-subtle',
    past: 'border border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
};

/** Legend/badge dots per state. */
export const DEPARTURE_DOT_CLASS: Record<CalendarDepartureState, string> = {
    open: 'bg-cal-open-solid',
    soldOut: 'bg-cal-sold-solid',
    closed: 'bg-muted-foreground',
    cancelled: 'bg-danger-solid',
    past: 'bg-muted-foreground/50',
};

/**
 * The noun one UNIT booking takes whole - "Whole boat", never "Free": on a
 * screen where every other number is seats sold, "Free" reads as no cost
 * (MCK-16 change 11, review F10).
 */
export function unitNoun(wholeUnitType?: WholeUnitType | null): string {
    switch (wholeUnitType) {
        case 'BOAT':
            return 'boat';
        case 'VEHICLE':
            return 'vehicle';
        case 'AIRCRAFT':
            return 'aircraft';
        case 'GROUP':
            return 'group';
        case 'PACKAGE':
            return 'package';
        default:
            return 'unit';
    }
}
