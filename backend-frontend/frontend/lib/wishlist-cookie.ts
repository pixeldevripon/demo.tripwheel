/**
 * Cookie storage for the guest wishlist (no login required).
 *
 * The saved set lives entirely in the browser in the `it.wishlist` cookie,
 * newest FIRST. Every write refreshes the 6-month lifetime, so an active
 * shopper's list never expires. Client-readable by design (the provider
 * reads/writes it directly); nothing personal is stored - only tour ids and
 * the price the shopper was looking at when they saved.
 *
 * ## Two formats, one reader
 *
 * v1 was a bare `["id", "id"]`. v2 keeps the ids in the same order and hangs a
 * price snapshot off each one, because mck-17 needs to say "Was $79 when you
 * saved it" and nothing in the system remembers that but the browser that was
 * showing it. `readWishlistCookie` accepts BOTH - a v1 cookie simply has no
 * snapshots, so it shows no price lines until those tours are re-saved. There
 * is no migration step and no expiry reset: the next write upgrades the cookie
 * in place.
 *
 * Pure + browser-safe: no imports, guarded `document` access.
 */

export const WISHLIST_COOKIE = 'it.wishlist';

/** 6 months, in seconds (180 days). */
export const WISHLIST_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

/**
 * How much of the ~4KB per-cookie budget the saved list may use.
 *
 * Under the limit on purpose. The cookie rides on every request to the site,
 * and the browser's ceiling covers the name and the attributes too, so
 * spending the whole allowance on the value is how a write silently fails.
 */
const MAX_COOKIE_BYTES = 3800;

/** Hard cap on saved tours, matching the backend resolver's own cap. */
export const MAX_SAVED_TOURS = 100;

/**
 * Field and entry separators, chosen because `encodeURIComponent` leaves them
 * alone.
 *
 * This is why v2 is not JSON. A hundred saved uuids as a JSON array encodes to
 * roughly 5.5KB, because every quote, bracket and comma triples into a percent
 * escape - the list would blow the cookie budget before a single price
 * snapshot was written. The same hundred ids in this format are about 3.7KB
 * and fit, so no saved tour has to be dropped to make room.
 */
const ENTRY_SEP = '!';
const FIELD_SEP = '~';
const V2_PREFIX = `2${ENTRY_SEP}`;

/**
 * One saved tour: its id, plus what it cost when it was saved.
 *
 * The price is stored EXACTLY as the shopper saw it - the display amount and
 * the display currency - rather than as a base amount. That makes the "was"
 * line a straight comparison of two numbers the same person was shown, with no
 * FX arithmetic in between that could turn a rate move into a fake price
 * change. The cost is that switching currency hides the line until the tour is
 * saved again, which is the honest answer: we cannot claim a price moved when
 * we are quoting it in a different money.
 */
export type SavedTour = {
    id: string;
    /** Display price at save time; absent for tours saved before v2. */
    price?: number;
    /** Currency that `price` was shown in. Always present when `price` is. */
    currency?: string;
};

/** `id` on its own, or `id~price~currency`. */
function parseEntry(entry: string): SavedTour | null {
    if (!entry) return null;
    const [id, price, currency] = entry.split(FIELD_SEP);
    if (!id) return null;
    const amount = Number(price);
    if (price !== undefined && currency && Number.isFinite(amount)) {
        return { id, price: amount, currency };
    }
    return { id };
}

function writeEntry(tour: SavedTour, withPrice: boolean): string {
    return withPrice && tour.price !== undefined && tour.currency
        ? `${tour.id}${FIELD_SEP}${tour.price}${FIELD_SEP}${tour.currency}`
        : tour.id;
}

/** The v1 format: a JSON array of bare ids. */
function readLegacy(decoded: string): SavedTour[] {
    try {
        const parsed: unknown = JSON.parse(decoded);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .map(id => ({ id }));
    } catch {
        return [];
    }
}

/**
 * Parse the wishlist cookie into saved tours, newest first. Reads v1 and v2;
 * anything unparseable is an empty list rather than a thrown page.
 */
export function readWishlistCookie(cookieString: string): SavedTour[] {
    const raw = cookieString
        .split('; ')
        .find(part => part.startsWith(`${WISHLIST_COOKIE}=`))
        ?.slice(WISHLIST_COOKIE.length + 1);
    if (!raw) return [];

    let decoded: string;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        return []; // A malformed escape sequence - not our cookie any more.
    }

    const tours = decoded.startsWith(V2_PREFIX)
        ? decoded
              .slice(V2_PREFIX.length)
              .split(ENTRY_SEP)
              .map(parseEntry)
              .filter((t): t is SavedTour => t !== null)
        : readLegacy(decoded);

    return tours.slice(0, MAX_SAVED_TOURS);
}

/** Just the ids, newest first - what the resolver and the heart states want. */
export function readWishlistIds(cookieString: string): string[] {
    return readWishlistCookie(cookieString).map(t => t.id);
}

/**
 * Serialize, shedding price snapshots from the OLDEST entries until the cookie
 * fits its budget.
 *
 * Ids are never dropped: losing a saved tour to make room for a "was" line
 * would trade the feature for its footnote. The oldest snapshots go first
 * because a price captured months ago is the least likely to still be an
 * interesting comparison.
 */
function serialize(tours: SavedTour[]): string {
    const kept = tours.slice(0, MAX_SAVED_TOURS);
    // Snapshots survive from the newest entry backwards; `withPrice` is how
    // many still carry one.
    let withPrice = kept.length;
    const encode = () =>
        encodeURIComponent(
            V2_PREFIX +
                kept
                    .map((tour, i) => writeEntry(tour, i < withPrice))
                    .join(ENTRY_SEP)
        );

    let out = encode();
    while (out.length > MAX_COOKIE_BYTES && withPrice > 0) {
        withPrice--;
        out = encode();
    }
    return out;
}

/** Persist the saved tours (newest first), refreshing the 6-month expiry. */
export function writeWishlistCookie(tours: SavedTour[]): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${WISHLIST_COOKIE}=${serialize(
        tours
    )}; path=/; max-age=${WISHLIST_COOKIE_MAX_AGE}; samesite=lax`;
}
