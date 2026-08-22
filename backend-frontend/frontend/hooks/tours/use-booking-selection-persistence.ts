'use client';

import { useBookingStoreApi } from '@/contexts/booking-context';
import { toDateParam } from '@/lib/checkout/checkout';
import type {
    BookingStore,
    PersistedBookingSelection,
} from '@/lib/stores/booking-store';
import { useEffect } from 'react';

/** Per-tour sessionStorage key - one tab's flow never leaks into another tab. */
export const bookingSelectionKey = (tourId: string) =>
    `it-booking-selection:${tourId}`;

/** Read + parse the persisted selection for a tour (null on anything broken). */
export function readBookingSelection(
    tourId: string
): Partial<PersistedBookingSelection> | null {
    try {
        const raw = window.sessionStorage.getItem(bookingSelectionKey(tourId));
        if (!raw) return null;
        const sel = JSON.parse(raw) as Partial<PersistedBookingSelection>;
        return sel && typeof sel === 'object' ? sel : null;
    } catch {
        return null;
    }
}

/** Merge-write fields into the persisted selection (storage errors swallowed). */
export function writeBookingSelection(
    tourId: string,
    patch: Partial<PersistedBookingSelection>
): void {
    try {
        const current = readBookingSelection(tourId) ?? {};
        window.sessionStorage.setItem(
            bookingSelectionKey(tourId),
            JSON.stringify({ ...current, ...patch })
        );
    } catch {
        // Storage full / private mode: booking still works, just unsaved.
    }
}

const prune = (map: Record<string, number>) =>
    Object.fromEntries(Object.entries(map).filter(([, n]) => n > 0));

/**
 * Keeps the widget selection (date / time / party / extras) alive across a
 * checkout round-trip. The per-card Zustand store is created fresh on every
 * mount, so navigating Continue -> checkout -> "Back to tour" would otherwise
 * reset everything the traveller picked.
 *
 * Mounted once inside the card; a no-op in design/demo mode (no `tourId`).
 *
 * ONE effect does restore-then-subscribe, in that order, against the store API
 * directly - never through reactive render values. A separate "persist on
 * change" effect would fire its first run with the PRE-restore render's stale
 * closure and clobber the snapshot with defaults (and React StrictMode's
 * double-mount makes that race a certainty in dev).
 *
 *  - Restore re-validates everything against the CURRENT tour data via the
 *    store's `hydrateSelection` (unknown band / add-on ids dropped, quantities
 *    re-clamped, past dates ignored).
 *  - The TIME is restored only once the date's live slots arrive AND still
 *    offer it - a slot that sold out (or moved) while the traveller was on
 *    checkout silently stays unselected instead of faking availability.
 *  - Every later change is merge-written back (the checkout page shares the
 *    same key for the pickup selection - never overwrite fields not ours).
 */
export function useBookingSelectionPersistence(): void {
    const store = useBookingStoreApi();

    useEffect(() => {
        const { tourId } = store.getState();
        if (!tourId) return;

        // ── 1. Restore (before any write can possibly happen) ──
        const saved = readBookingSelection(tourId);
        let pendingTime: string | null = null;
        if (saved) {
            store.getState().hydrateSelection({
                date: typeof saved.date === 'string' ? saved.date : null,
                time: null,
                counts: saved.counts ?? {},
                addOnQty: saved.addOnQty ?? {},
            });
            pendingTime = typeof saved.time === 'string' ? saved.time : null;
        }

        const snapshotOf = (s: BookingStore): PersistedBookingSelection => ({
            date: s.selectedDate ? toDateParam(s.selectedDate) : null,
            // While the restored time is still waiting for the date's live
            // slots, keep persisting IT - writing the store's transient null
            // would wipe the saved time before it can re-select (and React
            // StrictMode's double-mount re-reads the snapshot in between).
            time: s.selectedTime ?? pendingTime,
            counts: prune(s.counts),
            addOnQty: prune(s.addOnQty),
        });

        // ── 2. Subscribe: persist every selection change from the LIVE store ──
        const persist = (s: BookingStore) =>
            writeBookingSelection(tourId, snapshotOf(s));
        const unsubscribe = store.subscribe(s => {
            // Re-select the restored time once the date's live slots confirm
            // it still exists (one shot - confirm or drop).
            if (pendingTime && s.daySlots != null && s.selectedTime == null) {
                const time = pendingTime;
                pendingTime = null;
                const slot = s.daySlots.find(
                    x => x.time === time && x.status !== 'sold_out'
                );
                if (slot) {
                    s.selectTime(time);
                    return; // the nested set re-notifies; persist then.
                }
            }
            persist(s);
        });
        // Write the restored state once so the snapshot reflects re-validation.
        persist(store.getState());

        return unsubscribe;
    }, [store]);
}
