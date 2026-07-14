/**
 * Pure date/formatting helpers for the booking widget. No React, no state -
 * safe to import from any component in the widget.
 */

// Shared easing for every expand/collapse (mirrors --it-ease).
export const COLLAPSE_EASE = [0.4, 0, 0.2, 1] as const;

export const DAY_MS = 86_400_000;

// A wall-clock "HH:MM" start time formatted for the locale (12h + AM/PM in en,
// 24h in most others). Built on a fixed UTC date so only the clock time shows.
export function formatTime(hhmm: string, locale: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) return hhmm;
    const date = new Date(Date.UTC(2000, 0, 1, h, m || 0));
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(date);
}

// "Tue 28 May" - the selected date, locale-formatted.
export function formatSelectedDate(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
}

// Midnight of a date (local), for whole-day comparisons.
export function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Monday-first weekday index (Mon=0 … Sun=6) for a JS getDay() (Sun=0 … Sat=6).
export function mondayIndex(jsDay: number): number {
    return (jsDay + 6) % 7;
}

// Localized short weekday headers, Monday-first (built off a known Monday).
export function weekdayLabels(locale: string): string[] {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) =>
        fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))
    );
}

// "March" (or the localized long month name) for a month/year.
export function monthName(m: number, y: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
        new Date(y, m, 1)
    );
}
