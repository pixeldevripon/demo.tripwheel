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
 * One derivation per store state, shared by every subscriber.
 *
 * `deriveBooking` is a ~250-line pure function that builds totals, capacity,
 * flow flags and `Intl` formatters. Thirteen components call `useBooking()`, so
 * a single stepper tick used to run it thirteen times over the SAME state -
 * identical inputs, identical output, twelve times wasted.
 *
 * Keyed by the state object itself: zustand replaces that object on every
 * `set`, so a new state always misses the cache and a shared state always hits
 * it. A WeakMap (not a one-entry cache) keeps this correct when more than one
 * booking store is alive - the store is per-card via `booking-context` - and
 * lets superseded states be collected as soon as zustand drops them.
 */
const derivedByState = new WeakMap<
    BookingStore,
    ReturnType<typeof deriveBooking>
>();

function deriveOnce(state: BookingStore) {
    const cached = derivedByState.get(state);
    if (cached) return cached;
    const value = deriveBooking(state);
    derivedByState.set(state, value);
    return value;
}

/**
 * The full booking view: raw store state + actions, plus every derived value
 * (totals, capacity, flow flags, `money`/`fillPolicy` formatters) computed by
 * `deriveBooking`. Subscribes to the whole store, so it re-renders on any flow
 * change - the convenient default for the card's sections.
 */
export function useBooking() {
    const state = useBookingStore(s => s);
    return { ...state, ...deriveOnce(state) };
}
