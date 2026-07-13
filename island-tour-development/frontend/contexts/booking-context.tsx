'use client';

import {
    createBookingStore,
    type BookingInit,
    type BookingStoreApi,
} from '@/lib/stores/booking-store';
import { createContext, useContext, useState, type ReactNode } from 'react';

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
    destinationSlug,
    tourSlug,
    children,
}: BookingInit & { children: ReactNode }) {
    // Create the store exactly once for this card (stable across re-renders); a
    // new tour route remounts the provider and gets a fresh store.
    const [store] = useState(() =>
        createBookingStore({ dict, data, locale, destinationSlug, tourSlug })
    );
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
