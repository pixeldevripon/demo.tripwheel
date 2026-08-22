/**
 * Pure helpers for the saved tours page (mck-17). No React, no browser APIs -
 * everything here is a function of the saved list and the cards it resolved to.
 */

import type { PriceSnapshot } from '@/components/frontend/wishlist-provider';

/**
 * The price this tour cost when it was saved, IF that is worth showing.
 *
 * Returns null - meaning no line at all - when nothing has changed, when we
 * never captured a price (a list saved before the snapshot existed), or when
 * the shopper is now looking at a different currency. That last one is the
 * subtle case: we stored the number the traveller was shown, so comparing it
 * against a price quoted in another money would report an exchange rate as a
 * price change.
 *
 * Both directions qualify. A tour that got cheaper is as much a reason to come
 * back as one that got dearer, and the line stays muted for both - mck-17 is
 * explicit that this is information, not a nudge.
 */
export function savedPriceWas(
    snapshot: PriceSnapshot | null,
    current: { price: number; currency: string }
): number | null {
    if (!snapshot) return null;
    if (snapshot.currency !== current.currency) return null;
    // Both sides are already rounded to cents by `resolveDisplayPrice`; the
    // epsilon guards float noise, not a real half-cent movement.
    if (Math.abs(snapshot.price - current.price) < 0.005) return null;
    return snapshot.price;
}

/**
 * The single island every saved tour belongs to, or null when they span more
 * than one.
 *
 * The meta row reads "{n} tours · {Island}", which is only true of a list that
 * sits on one island. Saves spanning two islands drop the name rather than
 * pick a winner; mck-17 describes grouping by destination for that case but
 * does not draw it, so this is the honest half of the answer rather than an
 * invented one.
 */
export function soleDestinationSlug(
    cards: { destinationSlug?: string | null }[]
): string | null {
    const slugs = new Set(
        cards.map(c => c.destinationSlug).filter((s): s is string => Boolean(s))
    );
    return slugs.size === 1 ? [...slugs][0] : null;
}

/**
 * Whether the saved list needs re-resolving against the backend.
 *
 * True only when an id appears that has never been resolved. That asymmetry is
 * the whole point:
 *
 * - An ADDITION must refetch. Saving a tour from the empty state's suggestion
 *   row adds an id with no card behind it, and without a refetch the page kept
 *   its "Nothing saved yet" state while the nav badge counted up and the heart
 *   filled in - the list denying tours it was simultaneously showing as saved.
 * - A REMOVAL must not. It is already reflected optimistically by filtering the
 *   cards on screen, so refetching would spend a request to render what is
 *   already there, minus one card.
 */
export function needsResolve(
    sourceIds: string[],
    resolvedIds: ReadonlySet<string>
): boolean {
    return sourceIds.some(id => !resolvedIds.has(id));
}

/**
 * Read a comma-separated id list off a URL parameter.
 *
 * Shared and emailed links carry ids in the query string, so this is
 * attacker-controlled input: anything that is not a plausible id is dropped
 * rather than forwarded to the backend, and the whole thing is capped at the
 * resolver's own limit.
 */
export function parseIdList(value: string | null | undefined): string[] {
    if (!value) return [];
    return [
        ...new Set(
            value
                .split(',')
                .map(id => id.trim())
                .filter(id => /^[A-Za-z0-9_-]{1,64}$/.test(id))
        ),
    ].slice(0, 100);
}
