import type { TourException, TourSchedule } from '@/types/trip';

/**
 * Availability derivations (Phase 18): business logic that used to live
 * inside the schedules VIEW file (trip-schedules-tab.tsx) - moved here so
 * the schedules UI, the exception form's "departures on this date" preview,
 * and anything else can share one truth.
 */

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
