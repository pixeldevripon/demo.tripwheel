/**
 * Grouping for the account bookings list (review 5.2-5.3).
 *
 * Time-based triage instead of an admin table: the next confirmed trip is
 * pinned on top, the rest split into Upcoming / Past / Cancelled. Whether a
 * trip is "past" comes from SERVER verdicts (`REDEEMED`, or the cancellation
 * gate's `DEPARTED` reason) - the start time is an island wall clock and the
 * browser's clock cannot judge it.
 */
import type { TravellerBooking } from '@/lib/api/public/traveller';

export interface TravellerGroups {
    /** Soonest upcoming CONFIRMED booking - rendered once, not in `upcoming`. */
    nextTrip: TravellerBooking | null;
    upcoming: TravellerBooking[];
    past: TravellerBooking[];
    cancelled: TravellerBooking[];
}

/** Transient checkout states never list (review 5.6: pending never renders). */
const NEVER_LISTED = new Set(['ON_HOLD', 'PENDING', 'EXPIRED']);

/** Requested first, then executed - all collapsed at the bottom, muted. */
const CANCELLED_FAMILY = new Set([
    'CANCELLATION_REQUESTED',
    'OPERATOR_CANCELLATION_REPORTED',
    'CANCELLED',
    'REJECTED',
    'FORFEITED',
]);

export function isCancelledFamily(displayStatus: string): boolean {
    return CANCELLED_FAMILY.has(displayStatus);
}

/** The booking's local start as a comparable number (wall clock, UTC-pinned). */
function startMs(b: TravellerBooking): number {
    const t = Date.parse(`${b.localDate}T${b.startTime ?? '00:00'}:00Z`);
    return Number.isNaN(t) ? 0 : t;
}

function cancelMs(b: TravellerBooking): number {
    const t = Date.parse(b.utcCancellationRequestedAt ?? b.createdAt);
    return Number.isNaN(t) ? 0 : t;
}

export function groupTravellerBookings(
    rows: TravellerBooking[],
    /** False past page 1 of a 50+ booking account - the module needs page 1's rows. */
    extractNextTrip: boolean
): TravellerGroups {
    const upcoming: TravellerBooking[] = [];
    const past: TravellerBooking[] = [];
    const cancelled: TravellerBooking[] = [];

    for (const b of rows) {
        if (NEVER_LISTED.has(b.displayStatus)) continue;
        if (CANCELLED_FAMILY.has(b.displayStatus)) {
            cancelled.push(b);
        } else if (
            b.displayStatus === 'REDEEMED' ||
            b.cancellationBlockedReason === 'DEPARTED'
        ) {
            past.push(b);
        } else {
            upcoming.push(b);
        }
    }

    upcoming.sort((a, b) => startMs(a) - startMs(b));
    past.sort((a, b) => startMs(b) - startMs(a));
    cancelled.sort((a, b) => {
        const aReq = a.displayStatus === 'CANCELLATION_REQUESTED' ? 0 : 1;
        const bReq = b.displayStatus === 'CANCELLATION_REQUESTED' ? 0 : 1;
        return aReq - bReq || cancelMs(b) - cancelMs(a);
    });

    let nextTrip: TravellerBooking | null = null;
    if (extractNextTrip) {
        const i = upcoming.findIndex(b => b.displayStatus === 'CONFIRMED');
        if (i >= 0) {
            nextTrip = upcoming[i];
            upcoming.splice(i, 1);
        }
    }

    return { nextTrip, upcoming, past, cancelled };
}

/**
 * Is the free-cancellation window still open?
 *
 * A MISSING DEADLINE MEANS CLOSED. The free window cannot be evidenced without
 * one, and we never promise a refund we cannot back. That rule was written down
 * once but enforced in three components - the payment box, the cancel panel and
 * the next-trip hero - which all render simultaneously inside a single expanded
 * booking card. Softening it in one place gave a card whose payment box and
 * cancel box contradicted each other about the same booking.
 *
 * Judged against the SERVER's request instant (`nowMs`), never a live
 * `Date.now()`: reading the clock during render is impure, and this copy must
 * not flip mid-session. The authoritative judgement is the backend's anyway -
 * this only decides which sentence to show.
 */
export function freeWindowOpen(
    deadline: string | null | undefined,
    nowMs: number
): boolean {
    return deadline ? new Date(deadline).getTime() > nowMs : false;
}

/**
 * Whole days until the trip's island date, judged from the server-stamped
 * request instant. Plain arithmetic on UTC-pinned dates - a plain kicker
 * ("in 2 days"), not countdown theater, so an edge-of-midnight skew is fine.
 */
export function daysUntil(localDate: string, nowMs: number): number {
    const start = Date.parse(`${localDate}T00:00:00Z`);
    if (Number.isNaN(start)) return 0;
    const todayStart = Math.floor(nowMs / 864e5) * 864e5;
    return Math.round((start - todayStart) / 864e5);
}
