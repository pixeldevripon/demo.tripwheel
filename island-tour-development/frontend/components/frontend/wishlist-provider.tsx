'use client';

/**
 * Client-side wishlist store for the public site - COOKIE-BASED, no login.
 *
 * The saved set is a JSON array of tour ids in the 6-month `it.wishlist`
 * cookie (see `lib/wishlist-cookie.ts`), newest first. Anyone can heart a tour;
 * `TourCard` hearts and the navbar badge read from this store, and every toggle
 * rewrites the cookie (which also slides the 6-month expiry forward). The
 * wishlist page resolves the ids into cards via the public
 * `GET /wishlist/resolve` endpoint.
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
} from '@/lib/wishlist-cookie';
import type { Locale } from '@/lib/constants/locales';

type WishlistContextValue = {
    /** False until the cookie has been read on the client (avoids SSR flash). */
    ready: boolean;
    /** Number of saved tours. */
    count: number;
    /** Saved tour ids, newest first (drives the wishlist page). */
    ids: string[];
    isSaved: (tourId: string) => boolean;
    /** Toggle a tour in the cookie store. Works for everyone - no login. */
    toggle: (tourId: string) => void;
};

const noop: WishlistContextValue = {
    ready: true,
    count: 0,
    ids: [],
    isSaved: () => false,
    toggle: () => {},
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
    const [ids, setIds] = useState<string[]>([]);
    const [ready, setReady] = useState(false);

    // Hydrate from the cookie once on mount, and refresh its 6-month expiry so
    // a returning shopper's list keeps sliding forward.
    useEffect(() => {
        const saved = readWishlistCookie(document.cookie);
        setIds(saved);
        setReady(true);
        if (saved.length > 0) writeWishlistCookie(saved);
    }, []);

    const isSaved = useCallback(
        (tourId: string) => ids.includes(tourId),
        [ids],
    );

    const toggle = useCallback((tourId: string) => {
        setIds((prev) => {
            const next = prev.includes(tourId)
                ? prev.filter((id) => id !== tourId)
                : [tourId, ...prev]; // newest first
            writeWishlistCookie(next);
            return next;
        });
    }, []);

    const value = useMemo<WishlistContextValue>(
        () => ({ ready, count: ids.length, ids, isSaved, toggle }),
        [ready, ids, isSaved, toggle],
    );

    return (
        <WishlistContext.Provider value={value}>
            {children}
        </WishlistContext.Provider>
    );
}
