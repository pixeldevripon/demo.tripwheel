import { addDays, format } from 'date-fns';
import type { TourException, TourSchedule } from '@/types/trip';

/**
 * Availability derivations (Phase 18): business logic that used to live
 * inside the schedules VIEW file (trip-schedules-tab.tsx) - moved here so
 * the schedules UI, the exception form's "departures on this date" preview,
 * and anything else can share one truth.
 */

/**
 * The agenda's forward horizon: today through today+364, the materialization
 * window (E.9). The date picker already refuses anything outside it, so the
 * week arrows must refuse it too.
 */
export const AGENDA_HORIZON_DAYS = 364;

/** The agenda's own 7-day rule - the day picked, plus six (review comment 11,
 *  the same window the Calendar's week view uses). */
export const AGENDA_WINDOW_DAYS = 7;

/** Step a 'YYYY-MM-DD' key by whole days, on the local calendar. */
export function shiftDateKey(key: string, delta: number): string {
    return format(addDays(new Date(`${key}T00:00:00`), delta), 'yyyy-MM-dd');
}

/**
 * Where the agenda's week arrows land: one week either side of `start`,
 * clamped to the horizon the date picker allows. Clamping rather than
 * refusing means Back from today+3 still reaches today instead of dead-ending
 * three days short of it - the arrow only goes inert once it is AT the floor.
 */
export function stepAgendaWeek(
    start: string,
    dir: 1 | -1,
    todayKey: string,
): string {
    const next = shiftDateKey(start, AGENDA_WINDOW_DAYS * dir);
    const ceiling = shiftDateKey(todayKey, AGENDA_HORIZON_DAYS);
    if (next < todayKey) return todayKey;
    if (next > ceiling) return ceiling;
    return next;
}

/**
 * The scheduled start times that exist on a given date: recurring rules whose
 * weekday + valid window cover it (ACTIVE only), plus any ADD_SLOT exceptions
 * on that date. This is what CLOSE_SLOT / SET_CAPACITY let the operator
 * target.
 */
export function scheduledSlotsForDate(
    dateStr: string,
    schedules: TourSchedule[],
    exceptions: TourException[],
): string[] {
    if (!dateStr) return [];
    const d = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return [];
    const weekday = (d.getDay() + 6) % 7; // JS Sun=0 → Mon=0
    const times = new Set<string>();
    for (const s of schedules) {
        if (s.weekday !== weekday || s.status !== 'ACTIVE') continue;
        if (s.validFrom && dateStr < s.validFrom) continue;
        if (s.validUntil && dateStr > s.validUntil) continue;
        times.add(s.startTime);
    }
    for (const ex of exceptions) {
        if (ex.type === 'ADD_SLOT' && ex.date === dateStr && ex.startTime)
            times.add(ex.startTime);
    }
    return [...times].sort();
}
