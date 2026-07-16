'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { quoteBooking, type QuoteRequest } from '@/lib/api/bookings';
import { useEffect } from 'react';

/** Debounce so quick stepper taps don't fire a quote per click. */
const QUOTE_DEBOUNCE_MS = 350;

/**
 * Ids the widget synthesises when a tour has no real age bands (`default-adult`)
 * or is unit-priced (`unit-guests`). They are NOT real `ageBandId`s, so a
 * PER_PERSON quote can't be built from them - such a selection stays on the
 * optimistic client estimate.
 */
const SYNTHETIC_BAND_IDS = new Set(['default-adult', 'unit-guests']);

/**
 * Keeps the booking store's server-authoritative quote in sync with the live
 * selection (guide §21.5). Mounted once inside the card; a no-op in design/demo
 * mode (no `tourId`) and until a complete, in-capacity selection resolves a real
 * departure.
 *
 * On every change to the departure, party, or currency it (debounced) calls
 * `POST /bookings/quote` and writes the result; the request is aborted when
 * superseded. It fails soft: an errored quote sets `quoteError` and the card
 * keeps its optimistic client estimate rather than blocking. When the selection
 * is incomplete it clears any stale quote so a number never outlives its inputs.
 */
export function useBookingQuote(): void {
    const {
        isLive,
        tourId,
        currency,
        data,
        counts,
        selectedDepartureId,
        travelerCount,
        overCapacity,
        setQuote,
        setQuoteLoading,
        setQuoteError,
    } = useBooking();

    // Build the request for the current selection, or null when it can't be quoted
    // (incomplete, over capacity, or synthetic-only bands). PER_PERSON sends one
    // item per counted age band (spectators are age bands too); UNIT sends guests.
    let req: QuoteRequest | null = null;
    if (isLive && tourId && selectedDepartureId && travelerCount >= 1 && !overCapacity) {
        if (data.pricingModel === 'UNIT') {
            req = {
                tourId,
                departureId: selectedDepartureId,
                guests: travelerCount,
                currency,
            };
        } else {
            const items = data.bands
                .map(b => ({ ageBandId: b.id, quantity: counts[b.id] ?? 0 }))
                .filter(i => i.quantity > 0);
            if (items.length > 0 && !items.some(i => SYNTHETIC_BAND_IDS.has(i.ageBandId))) {
                req = { tourId, departureId: selectedDepartureId, items, currency };
            }
        }
    }

    // Primitive trigger: the effect only refires when the request materially
    // changes; `req` itself is rebuilt from the key inside the effect.
    const reqKey = req ? JSON.stringify(req) : null;

    useEffect(() => {
        if (!reqKey) {
            // Selection incomplete: drop any stale quote so the summary falls back
            // to the optimistic client estimate, not a number for another selection.
            setQuote(null);
            return;
        }
        const parsed: QuoteRequest = JSON.parse(reqKey);
        const controller = new AbortController();
        setQuoteLoading(true);
        const timer = setTimeout(() => {
            quoteBooking(parsed, controller.signal)
                .then(setQuote)
                .catch(() => {
                    if (controller.signal.aborted) return;
                    setQuoteError(true);
                });
        }, QUOTE_DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [reqKey, setQuote, setQuoteLoading, setQuoteError]);
}
