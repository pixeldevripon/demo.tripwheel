/**
 * Document navigation for the booking flow's hand-off hops.
 *
 * WHY NOT `router.push` / `router.replace`:
 *
 * None of the routes in this flow can be prerendered for real inputs - the
 * checkout and processing pages are per-tour, and the thank-you page is keyed
 * by `publicRef`, an unguessable runtime token that `generateStaticParams` can
 * never enumerate. On Vercel, a client-router RSC request for a NON-prerendered
 * path is answered with the full HTML document (`content-type: text/html`)
 * instead of the flight payload, even though Next matched the `.rsc` route:
 *
 *   $ curl -sD- -o/dev/null -H "RSC: 1" \
 *       "https://<site>/en/<dest>/thank-you/<real-ref>?_rsc=x" | grep -i content-type
 *   content-type: text/html; charset=utf-8      # broken
 *   # ...while the prerendered demo ref on the SAME route answers correctly:
 *   content-type: text/x-component              # fine
 *
 * The router cannot parse HTML as a flight payload, so it discards ~180 KB,
 * aborts the client navigation and falls back to a browser navigation anyway.
 * The traveller pays for that round trip as a stall on a payment confirmation
 * screen. Going straight to a document navigation removes the wasted fetch and
 * the stall; the destination and history semantics are identical.
 *
 * This is a WORKAROUND for a platform bug, not a preference. Re-check with the
 * curl above after a Next/Vercel upgrade: once a non-prerendered path answers
 * `text/x-component`, these call sites can go back to the router.
 *
 * NEVER prefetch the thank-you page to warm this up. Rendering it claims the
 * one-time, mark-first `booking_complete` conversion push, so a prefetch would
 * consume it and the real render would fire nothing (master 8.2, rule #22).
 */

/**
 * Go to `href` as a new history entry (the traveller can come back).
 * Use for hops the traveller may legitimately reverse.
 */
export function leaveTo(href: string): void {
    window.location.assign(href);
}

/**
 * Go to `href` REPLACING the current history entry, so Back skips it.
 * Use when returning to this page would be wrong - the processing hop must
 * never send someone back into a checkout they have already paid for.
 */
export function leaveToReplacing(href: string): void {
    window.location.replace(href);
}
