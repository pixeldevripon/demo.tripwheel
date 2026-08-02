'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { quoteBooking, type QuoteRequest } from '@/lib/api/bookings';
import { buildBookingSelection } from '@/lib/checkout/checkout';
import { useEffect } from 'react';

/** Debounce so quick stepper taps don't fire a quote per click. */
const QUOTE_DEBOUNCE_MS = 350;

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
        addOnQty,
        selectedDepartureId,
        travelerCount,
        overCapacity,
        setQuote,
        setQuoteLoading,
        setQuoteError,
    } = useBooking();

    // Chosen extras ride along on every quote so the server total includes them.
    const addOns = data.addOns
        .map(a => ({ addOnId: a.id, quantity: addOnQty[a.id] ?? 0 }))
        .filter(a => a.quantity > 0);

    // Build the request for the current selection, or null when it can't be
    // quoted (incomplete, over capacity, or synthetic-only bands).
    //
    // `buildBookingSelection` is THE shared party-payload builder - its own
    // docblock promises "the live quote and the checkout reserve always build
    // the identical selection", and this hook used to re-implement it (plus its
    // own copy of SYNTHETIC_BAND_IDS). That is not a cosmetic duplicate: the two
    // must agree, or the price quoted in the widget is not the price reserved at
    // checkout.
    const selection =
        isLive && tourId && selectedDepartureId && travelerCount >= 1 && !overCapacity
            ? buildBookingSelection(data, counts)
            : null;
    const req: QuoteRequest | null =
        selection && tourId && selectedDepartureId
            ? {
                  tourId,
                  departureId: selectedDepartureId,
                  ...selection,
                  currency,
                  ...(addOns.length > 0 ? { addOns } : {}),
              }
            : null;

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
