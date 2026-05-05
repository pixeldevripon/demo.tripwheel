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
