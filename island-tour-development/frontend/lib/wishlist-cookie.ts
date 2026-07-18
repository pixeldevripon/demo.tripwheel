/**
 * Cookie storage for the guest wishlist (no login required).
 *
 * The saved set lives entirely in the browser as a JSON array of tour ids in
 * the `it.wishlist` cookie, newest FIRST. Every write refreshes the 6-month
 * lifetime, so an active shopper's list never expires. Client-readable by
 * design (the provider reads/writes it directly); nothing personal is stored -
 * only tour ids.
 *
 * Pure + browser-safe: no imports, guarded `document` access.
 */

export const WISHLIST_COOKIE = 'it.wishlist';

/** 6 months, in seconds (180 days). */
export const WISHLIST_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

/** Parse the wishlist cookie into an ordered id array (newest first). */
export function readWishlistCookie(cookieString: string): string[] {
    const raw = cookieString
        .split('; ')
        .find((part) => part.startsWith(`${WISHLIST_COOKIE}=`))
        ?.slice(WISHLIST_COOKIE.length + 1);
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(decodeURIComponent(raw));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
        return [];
    }
}

/** Persist the id array (newest first), refreshing the 6-month expiry. */
export function writeWishlistCookie(ids: string[]): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${WISHLIST_COOKIE}=${encodeURIComponent(
        JSON.stringify(ids),
    )}; path=/; max-age=${WISHLIST_COOKIE_MAX_AGE}; samesite=lax`;
}
