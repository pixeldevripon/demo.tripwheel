/**
 * Tour-title composition — the dashboard's half of a CROSS-REPO mirror.
 *
 * The public site owns the real thing in `island-tour-development/frontend`'s
 * `lib/tours/tour-name.ts`. This file exists so the Basics step can PREVIEW
 * what that file will render, and it is only useful while the two agree: a
 * preview that disagrees with the page is worse than no preview, because the
 * operator now trusts a wrong answer. Nothing here fails to compile if the
 * public rule changes — if `tourPageH1` moves there, move it here too.
 *
 * The stored tour title is hub-free and island-free. LD15 composes the H1 at
 * RENDER time, so the prefix never lives in the database and is invisible from
 * the editor unless something shows it.
 */

/**
 * The agreed title range (client review comment 15).
 *
 * A TARGET, not a gate — the backend's own rule is 3-120, and live tours
 * already sit outside 35-60. See `titleLengthState`.
 */
export const TITLE_MIN = 35;
export const TITLE_MAX = 60;

/**
 * Tour page H1 (LD15): "{Hub or Destination}: {Tour name}".
 *
 * Mirrors the public site's `tourPageH1`. Only the H1 composes — the
 * breadcrumb crumb, gallery alts, share text and JSON-LD all keep the bare
 * tour name.
 */
export function tourPageH1(prefix: string, title: string): string {
    return `${prefix}: ${title}`;
}

/**
 * The H1's prefix: the primary hub's name, falling back to the destination.
 *
 * `hubs[0]` stands in for the primary hub — `TourHub` has no `isPrimary` yet,
 * and the public site makes exactly the same stand-in. Null when neither is
 * known (no destination picked yet), which is the signal to render nothing:
 * half a composed H1 teaches the wrong shape.
 */
export function tourH1Prefix(
    hubName: string | null | undefined,
    destinationName: string | null | undefined,
): string | null {
    return hubName || destinationName || null;
}

/**
 * Where a title sits against the agreed range — advisory only.
 *
 * Deliberately NOT validation: `basicsSchema` keeps the backend's 3-120 rule,
 * so gating on 35-60 here would refuse saves the API accepts and lock
 * operators out of rows they can currently edit. Tightening it is a backend
 * decision first (issue 15 flags the same thing).
 */
export function titleLengthState(
    title: string,
): 'empty' | 'short' | 'ok' | 'long' {
    const len = title.trim().length;
    if (len === 0) return 'empty';
    if (len < TITLE_MIN) return 'short';
    if (len > TITLE_MAX) return 'long';
    return 'ok';
}
