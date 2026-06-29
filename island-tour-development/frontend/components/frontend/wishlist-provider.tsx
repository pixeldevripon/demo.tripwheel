'use client';

/**
 * Client-side wishlist store for the public site.
 *
 * - Reflects auth via Better Auth `useSession()` (the public shell stays static;
 *   per-user state is resolved here, in the browser).
 * - On login, hydrates the set of saved tour ids once; `TourCard` hearts and the
 *   navbar badge read from it. Mutations are optimistic with rollback.
 * - When a guest tries to save, we route them to /login instead of calling the API.
 *
 * `useWishlist()` returns a safe no-op default when used outside the provider,
 * so `TourCard` works anywhere (e.g. dashboard previews) without a provider.
 */

import { useRouter } from 'next/navigation';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { wishlistApi } from '@/lib/api/wishlist';
import { useSession } from '@/lib/auth-client';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type WishlistContextValue = {
    /** False until the Better Auth session has resolved (avoids auth-state flash). */
    ready: boolean;
    isAuthed: boolean;
    /** Number of saved tours (0 until hydrated or when signed out). */
    count: number;
    isSaved: (tourId: string) => boolean;
    /** Toggle a tour. Guests are routed to /login. Optimistic with rollback. */
    toggle: (tourId: string) => void;
};

const noop: WishlistContextValue = {
    ready: true,
    isAuthed: false,
    count: 0,
    isSaved: () => false,
    toggle: () => {},
};

const WishlistContext = createContext<WishlistContextValue>(noop);

export function useWishlist(): WishlistContextValue {
    return useContext(WishlistContext);
}

export function WishlistProvider({
    locale,
    children,
}: {
    locale: Locale;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { data: session, isPending } = useSession();
    const isAuthed = Boolean(session?.user);
    const ready = !isPending;

    const [ids, setIds] = useState<Set<string>>(new Set());

    // Hydrate (or clear) the saved-id set when auth state changes.
    useEffect(() => {
        if (!isAuthed) {
            setIds(new Set());
            return;
        }
        let ignore = false;
        wishlistApi
            .ids()
            .then((arr) => {
                if (!ignore) setIds(new Set(arr));
            })
            .catch(() => {
                if (!ignore) setIds(new Set());
            });
        return () => {
            ignore = true;
        };
    }, [isAuthed]);

    const isSaved = useCallback((tourId: string) => ids.has(tourId), [ids]);

    const toggle = useCallback(
        (tourId: string) => {
            if (!isAuthed) {
                router.push(localizeHref(locale, '/login'));
                return;
            }
            const currentlySaved = ids.has(tourId);

            // Optimistic update.
            setIds((prev) => {
                const next = new Set(prev);
                if (currentlySaved) next.delete(tourId);
                else next.add(tourId);
                return next;
            });

            const action = currentlySaved ? wishlistApi.remove(tourId) : wishlistApi.add(tourId);
            action.catch(() => {
                // Roll back on failure.
                setIds((prev) => {
                    const next = new Set(prev);
                    if (currentlySaved) next.add(tourId);
                    else next.delete(tourId);
                    return next;
                });
            });
        },
        [isAuthed, ids, locale, router],
    );

    const value = useMemo<WishlistContextValue>(
        () => ({ ready, isAuthed, count: ids.size, isSaved, toggle }),
        [ready, isAuthed, ids, isSaved, toggle],
    );

    return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
