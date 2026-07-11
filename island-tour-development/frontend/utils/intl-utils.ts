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
