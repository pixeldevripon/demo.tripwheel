/**
 * Environment-neutral half of the traveller booking record - importable from
 * Server Components and client code alike.
 *
 * Same split, and for the same reason, as `traveler-session.server.ts` /
 * `traveler-session.shared.ts`: `lib/traveler-booking.ts` reads and writes
 * `document.cookie`, so it declares itself client-only, but the TYP path shape
 * it defines is a plain string rule that the server needs too. Keeping the rule
 * here lets both sides share ONE definition instead of re-spelling the template
 * - which is how `/cancel/[publicRef]` ended up building `//thank-you/{ref}`, a
 * protocol-relative URL that navigates off-site.
 */

/** The one destination used when a booking has no island on it. */
const FALLBACK_DESTINATION_SLUG = 'curacao';

/**
 * Locale-less TYP path (served by the proxy rewrite at `proxy.ts`).
 *
 * The fallback is load-bearing, not defensive noise: `destinationSlug` comes
 * from `typ.island ?? ''` and `island` is nullable, so an empty slug is
 * reachable. Interpolating it bare produces `//thank-you/{ref}`, which browsers
 * read as protocol-relative and resolve to `http://thank-you/{ref}`.
 */
export function travelerBookingPath(
    destinationSlug: string | null,
    publicRef: string,
): string {
    return `/${destinationSlug || FALLBACK_DESTINATION_SLUG}/thank-you/${publicRef}`;
}
