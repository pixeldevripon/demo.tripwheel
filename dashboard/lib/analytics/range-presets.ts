/**
 * The reporting window for the dashboard overview.
 *
 * There is ONE range for the whole page, driven by a URL search param so the
 * server re-renders with a fresh payload instead of the client refetching. Every
 * FLOW on the page (money recognized, bookings created, customers acquired)
 * honours it; STOCKS (live trips, upcoming departures, registered accounts) are
 * current state and deliberately ignore it. The backend echoes the window it
 * applied back on `stats.range`, and the UI states it in words - the point of
 * the control is that no figure is left with an ambiguous period.
 *
 * Dates are UTC `YYYY-MM-DD` to match how the backend parses them.
 */

export type RangePresetId =
    | 'all'
    | '7d'
    | '30d'
    | 'month'
    | '3m'
    | 'year';

export interface RangePreset {
    id: RangePresetId;
    label: string;
}

/** All time is first and is the default, so the page opens on everything. */
export const RANGE_PRESETS: RangePreset[] = [
    { id: 'all', label: 'All time' },
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: 'month', label: 'This month' },
    { id: '3m', label: 'Last 3 months' },
    { id: 'year', label: 'This year' },
];

export const DEFAULT_RANGE_PRESET: RangePresetId = 'all';

/** The search param the overview reads its range from. */
export const RANGE_PARAM = 'range';

function iso(d: Date) {
    return d.toISOString().slice(0, 10);
}

function utcToday(now: Date) {
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
}

function addDays(d: Date, days: number) {
    return new Date(d.getTime() + days * 86_400_000);
}

/** Unknown or missing values fall back to the default rather than throwing. */
export function parseRangePreset(value: string | undefined): RangePresetId {
    return RANGE_PRESETS.some((p) => p.id === value)
        ? (value as RangePresetId)
        : DEFAULT_RANGE_PRESET;
}

/**
 * The preset as inclusive `from`/`to` dates. `all` returns neither bound, which
 * is what tells the backend to report all time.
 *
 * The day-count presets are rolling and INCLUSIVE of today, so "last 7 days"
 * spans today and the six before it - not 7 days ending yesterday.
 */
export function resolveRange(
    preset: RangePresetId,
    now: Date = new Date(),
): { from?: string; to?: string } {
    const today = utcToday(now);
    const to = iso(today);

    switch (preset) {
        case '7d':
            return { from: iso(addDays(today, -6)), to };
        case '30d':
            return { from: iso(addDays(today, -29)), to };
        case 'month':
            return {
                from: iso(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
                    ),
                ),
                to,
            };
        case '3m':
            return { from: iso(addDays(today, -89)), to };
        case 'year':
            return {
                from: iso(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))),
                to,
            };
        case 'all':
        default:
            return {};
    }
}

/**
 * The active window in plain words, e.g. "1 - 20 Jul 2026". Read straight off
 * the payload's `range` rather than recomputed from the preset, so what the
 * label claims is exactly what the numbers were filtered by.
 */
export function formatRangeLabel(range: {
    from: string | null;
    to: string | null;
    isAllTime: boolean;
}): string {
    if (range.isAllTime) return 'All time';

    const fmt = (value: string, withYear: boolean) =>
        new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-GB', {
            timeZone: 'UTC',
            day: 'numeric',
            month: 'short',
            ...(withYear ? { year: 'numeric' } : {}),
        });

    if (range.from && range.to) {
        const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
        return `${fmt(range.from, !sameYear)} - ${fmt(range.to, true)}`;
    }
    if (range.from) return `${fmt(range.from, true)} to now`;
    if (range.to) return `Up to ${fmt(range.to, true)}`;
    return 'All time';
}
