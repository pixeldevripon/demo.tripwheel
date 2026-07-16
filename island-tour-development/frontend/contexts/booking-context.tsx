'use client';

import {
    createBookingStore,
    type BookingInit,
    type BookingStoreApi,
} from '@/lib/stores/booking-store';
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';

/**
 * Holds one per-card Zustand store instance. The store is created once from the
 * tour's `data`/`dict`/`locale` and shared with every section of the card, so the
 * booking flow lives outside the render tree (Zustand) while still being scoped
 * to a single card. Read it with `useBooking()` / `useBookingStore()` from
 * `@/hooks/tours/use-booking`.
 */
const BookingStoreContext = createContext<BookingStoreApi | null>(null);

export function BookingStoreProvider({
    dict,
    data,
    locale,
    tourId,
    destinationSlug,
    tourSlug,
    currency,
    children,
}: BookingInit & { children: ReactNode }) {
    // Create the store exactly once for this card (stable across re-renders); a
    // new tour route remounts the provider and gets a fresh store.
    const [store] = useState(() =>
        createBookingStore({
            dict,
            data,
            locale,
            tourId,
            destinationSlug,
            tourSlug,
            currency,
        })
    );

    // A footer currency switch calls `router.refresh()`: the server re-renders
    // this provider with re-converted `data` and the new `currency`, but the
    // store was created once and would keep pricing in the old currency until a
    // hard reload. Sync the price model into the live store (band ids are stable,
    // so the traveler's date/time/party selection survives) and drop the stale
    // quote - the quote hook re-quotes automatically because `currency` is part
    // of its request key.
    useEffect(() => {
        const s = store.getState();
        if (
            s.currency === currency &&
            s.data.currencySymbol === (data?.currencySymbol ?? s.data.currencySymbol)
        ) {
            return;
        }
        const next = data ?? s.data;
        const participantBands = next.bands.filter(
            b => b.kind === 'participant'
        );
        const spectatorBands = next.bands.filter(b => b.kind === 'spectator');
        store.setState({
            data: next,
            currency,
            participantBands,
            spectatorBands,
            hasSpectators: spectatorBands.length > 0,
            isPatternB: participantBands.length > 1 || spectatorBands.length > 0,
            maxParty: next.maxPartySize ?? 99,
            quote: null,
        });
    }, [store, currency, data]);

    return (
        <BookingStoreContext.Provider value={store}>
            {children}
        </BookingStoreContext.Provider>
    );
}

/** The raw store API. Throws if used outside `<BookingStoreProvider>`. */
export function useBookingStoreApi(): BookingStoreApi {
    const store = useContext(BookingStoreContext);
    if (!store) {
        throw new Error(
            'useBookingStoreApi must be used within <BookingStoreProvider>'
        );
    }
    return store;
}
