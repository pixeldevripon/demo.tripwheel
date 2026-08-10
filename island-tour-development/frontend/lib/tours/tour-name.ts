/**
 * Tour-name compositions (mck-18 / master 3.5 / LD15).
 *
 * One stored, hub-free title; every surface composes upward from it rather
 * than rewriting it:
 *
 *  - Hub page cards (trips grid, Our Picks, comparison tables):
 *    "{Hub} {Title}", no eyebrow — founder decision, Aug 6 2026, a deliberate
 *    deviation from master 3.5's worked example, not to be reopened.
 *  - Every other listing surface: hub eyebrow + the bare title
 *    (rendered by <TourCard>; no helper needed).
 *  - Tour page H1: "{Hub or Destination}: {Title}" — LD15; the H1 always has
 *    a prefix, falling back to the destination when the tour has no hub.
 *  - Last breadcrumb crumb: the bare tour name (breadcrumbLabel above 35
 *    chars), never the composed H1.
 *
 * Surfaces after checkout (summary, thank-you, emails) are NOT settled —
 * mck-18 leaves them open. Do not import these helpers there until they are.
 *
 * The colon form is an English concatenation; per-locale forms (fr narrow
 * space, zh full-width colon, nl/de prepositions) are an open mck-18 item.
 */

/** Hub-page card title: hub + space + bare title ("Klein Curaçao Full-Day Catamaran"). */
export function hubCardTitle(hubName: string, title: string): string {
    return `${hubName} ${title}`;
}

/** Tour page H1 (LD15): "{Hub or Destination}: {Tour name}". */
export function tourPageH1(prefix: string, title: string): string {
    return `${prefix}: ${title}`;
}
