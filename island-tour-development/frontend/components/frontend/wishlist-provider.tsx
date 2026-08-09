'use client';

/**
 * Client-side wishlist store for the public site - COOKIE-BASED, no login.
 *
 * The saved set lives in the 6-month `it.wishlist` cookie (see
 * `lib/wishlist-cookie.ts`), newest first. Anyone can heart a tour; `TourCard`
 * hearts and the navbar badge read from this store, and every toggle rewrites
 * the cookie (which also slides the 6-month expiry forward). The saved tours
 * page resolves the ids into cards via the public `GET /wishlist/resolve`
 * endpoint.
 *
 * The store also remembers the price each tour was showing when it was saved,
 * which is the only place that fact exists - it is what lets the saved page say
 * "Was $79 when you saved it" (mck-17).
 *
 * `useWishlist()` returns a safe no-op default when used outside the provider,
 * so `TourCard` works anywhere (e.g. dashboard previews) without a provider.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    readWishlistCookie,
    writeWishlistCookie,
    type SavedTour,
} from '@/lib/wishlist-cookie';
import type { Locale } from '@/lib/constants/locales';

/** What a card knows about its own price when it is being saved. */
export type PriceSnapshot = { price: number; currency: string };

/** A removed tour and where it was, so an Undo can put it back exactly. */
export type RemovedTour = { tour: SavedTour; index: number };

type WishlistContextValue = {
    /** False until the cookie has been read on the client (avoids SSR flash). */
    ready: boolean;
    /** Number of saved tours. */
    count: number;
    /** Saved tour ids, newest first (drives the saved tours page). */
    ids: string[];
    isSaved: (tourId: string) => boolean;
    /** The price this tour was showing when it was saved, if we captured one. */
    savedPriceOf: (tourId: string) => PriceSnapshot | null;
    /**
     * Toggle a tour in the cookie store. Works for everyone - no login.
     * `snapshot` is the price on the card doing the saving; passing it is what
     * makes the price-integrity line possible later.
     */
    toggle: (tourId: string, snapshot?: PriceSnapshot) => void;
    /**
     * Remove a tour and hand back what was removed, so the caller can offer an
     * Undo. Returns null when the tour was not saved.
     */
    remove: (tourId: string) => RemovedTour | null;
    /** Put a removed tour back where it was. */
    restore: (removed: RemovedTour) => void;
    /**
     * Merge ids into the list without disturbing what is already there - the
     * "open my list on another device" link from the email.
     */
    adopt: (tourIds: string[]) => void;
};

const noop: WishlistContextValue = {
    ready: true,
    count: 0,
    ids: [],
    isSaved: () => false,
    savedPriceOf: () => null,
    toggle: () => {},
    remove: () => null,
    restore: () => {},
    adopt: () => {},
};

const WishlistContext = createContext<WishlistContextValue>(noop);

export function useWishlist(): WishlistContextValue {
    return useContext(WishlistContext);
}

export function WishlistProvider({
    children,
}: {
    /** Kept for call-site compatibility; the cookie store is locale-agnostic. */
    locale?: Locale;
    children: React.ReactNode;
}) {
    const [saved, setSaved] = useState<SavedTour[]>([]);
    const [ready, setReady] = useState(false);

    // Hydrate from the cookie once on mount, and refresh its 6-month expiry so
    // a returning shopper's list keeps sliding forward.
    useEffect(() => {
        const stored = readWishlistCookie(document.cookie);
        setSaved(stored);
        setReady(true);
        if (stored.length > 0) writeWishlistCookie(stored);
    }, []);

    // One writer for every mutation: the cookie is the source of truth, so a
    // state update that forgets to persist is a saved tour that vanishes on
    // reload. `commit` makes that impossible to get wrong.
    const commit = useCallback(
        (next: (prev: SavedTour[]) => SavedTour[]) => {
            setSaved(prev => {
                const value = next(prev);
                writeWishlistCookie(value);
                return value;
            });
        },
        []
    );

    const ids = useMemo(() => saved.map(t => t.id), [saved]);

    const isSaved = useCallback(
        (tourId: string) => saved.some(t => t.id === tourId),
        [saved]
    );

    const savedPriceOf = useCallback(
        (tourId: string): PriceSnapshot | null => {
            const entry = saved.find(t => t.id === tourId);
            if (!entry || entry.price === undefined || !entry.currency) {
                return null;
            }
            return { price: entry.price, currency: entry.currency };
        },
        [saved]
    );

    const toggle = useCallback(
        (tourId: string, snapshot?: PriceSnapshot) => {
            commit(prev =>
                prev.some(t => t.id === tourId)
                    ? prev.filter(t => t.id !== tourId)
                    : [{ id: tourId, ...snapshot }, ...prev] // newest first
            );
        },
        [commit]
    );

    const remove = useCallback(
        (tourId: string): RemovedTour | null => {
            const index = saved.findIndex(t => t.id === tourId);
            if (index === -1) return null;
            const tour = saved[index];
            commit(prev => prev.filter(t => t.id !== tourId));
            return { tour, index };
        },
        [saved, commit]
    );

    const restore = useCallback(
        ({ tour, index }: RemovedTour) => {
            commit(prev => {
                if (prev.some(t => t.id === tour.id)) return prev;
                const next = [...prev];
                // Clamped: the list may have shrunk further while the snackbar
                // was up, and splice past the end would silently append.
                next.splice(Math.min(index, next.length), 0, tour);
                return next;
            });
        },
        [commit]
    );

    const adopt = useCallback(
        (tourIds: string[]) => {
            commit(prev => {
                const known = new Set(prev.map(t => t.id));
                const incoming = tourIds
                    .filter(id => !known.has(id))
                    .map(id => ({ id }));
                return incoming.length === 0 ? prev : [...incoming, ...prev];
            });
        },
        [commit]
    );

    const value = useMemo<WishlistContextValue>(
        () => ({
            ready,
            count: saved.length,
            ids,
            isSaved,
            savedPriceOf,
            toggle,
            remove,
            restore,
            adopt,
        }),
        [ready, saved.length, ids, isSaved, savedPriceOf, toggle, remove, restore, adopt]
    );

    return (
        <WishlistContext.Provider value={value}>
            {children}
        </WishlistContext.Provider>
    );
}
