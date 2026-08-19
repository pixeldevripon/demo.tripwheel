/**
 * ONE clock (master E.9, MCK-16 change 4): every audit timestamp on an
 * availability surface renders in the TOUR's island zone, never the
 * viewer's browser zone - the same closure must read the same wall time on
 * the departure card, the agenda row and the Date changes register, or a
 * dispute surface disagrees with itself near midnight (code-review M12).
 *
 * Falls back to the platform home zone when a caller has no tour to borrow
 * a zone from (every launch island runs UTC-4).
 */
export const PLATFORM_HOME_TIMEZONE = 'America/Curacao';

export function islandTime(
    iso: string,
    timeZone: string = PLATFORM_HOME_TIMEZONE,
    opts: { day?: boolean } = { day: true },
): string {
    // Same guard as gmtLabel(): a malformed IANA zone from bad backend data
    // must degrade to the home-zone render, never crash the section.
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone,
            ...(opts.day !== false && { month: 'short', day: 'numeric' }),
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(iso));
    } catch {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: PLATFORM_HOME_TIMEZONE,
            ...(opts.day !== false && { month: 'short', day: 'numeric' }),
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(iso));
    }
}
