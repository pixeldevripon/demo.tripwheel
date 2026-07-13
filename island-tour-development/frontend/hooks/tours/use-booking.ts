'use client';

import { useBookingStoreApi } from '@/contexts/booking-context';
import { deriveBooking, type BookingStore } from '@/lib/stores/booking-store';
import { useStore } from 'zustand';

/**
 * Subscribe to a slice of the card's booking store. Use this when a section only
 * needs one or two fields and wants to avoid re-rendering on every flow change.
 */
export function useBookingStore<T>(selector: (state: BookingStore) => T): T {
    const store = useBookingStoreApi();
    return useStore(store, selector);
}

/**
 * The full booking view: raw store state + actions, plus every derived value
 * (totals, capacity, flow flags, `money`/`fillPolicy` formatters) computed by
 * `deriveBooking`. Subscribes to the whole store, so it re-renders on any flow
 * change - the convenient default for the card's sections.
 */
export function useBooking() {
    const state = useBookingStore(s => s);
    return { ...state, ...deriveBooking(state) };
}
