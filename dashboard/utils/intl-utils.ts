/**
 * Formats a date using the Intl.DateTimeFormat API.
 * @param date - The date to format (Date object, string, or number)
 * @param options - Intl.DateTimeFormatOptions to customize the output
 * @param locale - The locale to use (defaults to 'en-US')
 * @returns A formatted date string
 */
export function formatDate(
    date: Date | string | number = new Date(),
    options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    },
    locale: string = 'en-US'
) {
    try {
        const d = new Date(date);
        return new Intl.DateTimeFormat(locale, options).format(d);
    } catch (error) {
        console.error('Error formatting date:', error);
        return String(date);
    }
}

/**
 * Returns a list of all supported IANA timezones with their UTC offsets and formatted names.
 * @returns An array of timezone options
 */
export function getTimezoneOptions() {
    return Intl.supportedValuesOf('timeZone').map(tz => {
        try {
            const now = new Date();
            const offsetName = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'longOffset',
            })
                .formatToParts(now)
                .find(p => p.type === 'timeZoneName')?.value;

            const utcOffset = offsetName?.replace('GMT', 'UTC') || 'UTC+00:00';
            const location = tz.split('/').pop()?.replace(/_/g, ' ') || tz;

            return {
                label: `(${utcOffset}) ${location}`,
                value: tz,
            };
        } catch (e) {
            return { label: tz, value: tz };
        }
    }).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Detects the user's browser timezone.
 * @returns The IANA timezone string
 */
export function detectBrowserTimezone() {
    if (typeof window === 'undefined') return 'UTC';
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Parse a strict `YYYY-MM-DD` business date into plain calendar parts WITHOUT
 * going through `new Date(str)` - which parses it as midnight UTC and then
 * shifts a day for viewers in negative-offset zones. Returns null if malformed.
 */
export function parseLocalDateParts(
    localDate: string
): { year: number; month: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Format a destination-LOCAL calendar date (`YYYY-MM-DD`) for display without
 * any timezone shift - the value is a wall-clock day, not an instant. Use this
 * for tour localDate, schedule validFrom/validUntil, exception/departure dates,
 * etc. NEVER `formatDate(new Date(localDate))` for these (it shifts the day for
 * viewers outside the destination zone). Real UTC timestamps (createdAt, ...)
 * still use `formatDate`.
 */
export function formatLocalDateOnly(
    localDate: string,
    options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    },
    locale: string = 'en-US'
): string {
    const parts = parseLocalDateParts(localDate);
    if (!parts) return localDate;
    // Build a UTC-noon Date from the parts and format in UTC, so the calendar
    // day can never roll over regardless of the viewer's timezone.
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(d);
}

let ianaZones: Set<string> | null = null;
function getIanaZones(): Set<string> | null {
    if (ianaZones) return ianaZones;
    const supported = (
        Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    if (typeof supported !== 'function') return null;
    ianaZones = new Set(supported('timeZone'));
    return ianaZones;
}

/**
 * True when `value` is a real IANA timezone name (e.g. `America/Curacao`, or
 * `UTC`). Rejects offset labels (`UTC-4`, `+4`), legacy abbreviations (`AST`,
 * `EST`, `GMT`), human labels (`Curacao`), empty strings, and stray whitespace.
 * Destination/tour schedule math must always be anchored to an IANA zone, never
 * a fixed offset. Mirrors the backend `isValidIanaTimeZone` validator.
 */
export function isValidIanaTimeZone(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (value.trim() !== value || value.length === 0) return false;
    if (value === 'UTC') return true;

    const zones = getIanaZones();
    if (zones) return zones.has(value);

    if (!value.includes('/')) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
    } catch {
        return false;
    }
}
