'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { buildCheckoutQuery, toDateParam } from '@/lib/checkout/checkout';
import { leaveTo } from '@/lib/checkout/leave-to';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { useState } from 'react';

/**
 * The booking widget's primary action, in one place.
 *
 * Two controls fire it - the CTA pinned inside the card, and the mobile sticky
 * bar that stands in for the card once it has scrolled away (Pastel #37). They
 * must do the SAME thing: carry the same selection into the same checkout URL.
 * With the logic inlined in the button, the bar would have been a second copy
 * of the query builder, free to fall behind the day a field is added to it.
 *
 * `onIncomplete` is the only difference between the two callers. With no
 * complete selection the inline button just marks what is missing (the card is
 * already on screen); the sticky bar has to bring the card back into view
 * first, so it passes a scroll-and-focus callback that runs INSTEAD of the
 * store's own in-card step.
 */
export function useBookingCta(options?: {
    /**
     * Runs in place of the store's in-card prompt when the selection is not yet
     * complete. Return nothing; the caller decides what "get the traveller to
     * the card" means for its placement.
     */
    onIncomplete?: () => void;
}) {
    const {
        ready,
        handleCtaClick,
        locale,
        destinationSlug,
        tourSlug,
        selectedDate,
        selectedTime,
        counts,
        addOnQty,
        selectedDepartureId,
        quote,
        currency,
    } = useBooking();

    // Continue -> checkout is a full document navigation that can take a beat
    // (the route is dynamic). This drives a spinner in the button instead of a
    // frozen click. Plain state, not `useTransition`: the navigation leaves the
    // React tree entirely, so a transition would never report as pending - the
    // button would just sit there looking dead until the new page painted. The
    // latch is deliberately never cleared; the page is on its way out.
    const [navigating, setNavigating] = useState(false);

    const checkoutBase =
        destinationSlug && tourSlug
            ? localizeHref(
                  locale as Locale,
                  `/${destinationSlug}/${tourSlug}/checkout`
              )
            : null;
    // NOT prefetched: the checkout route is not prerendered for this tour, so a
    // router prefetch is answered with the HTML document and warms nothing (see
    // `lib/checkout/leave-to.ts`). It only cost a wasted request.

    // Once ready, the CTA carries the selection (date / time / party) into the
    // checkout page via the query string. Without a destination/tour slug
    // (design/demo usage) it falls back to the in-card availability flow.
    function onCta() {
        if (ready && checkoutBase) {
            if (navigating) return;
            const query = buildCheckoutQuery({
                date: selectedDate ? toDateParam(selectedDate) : null,
                time: selectedTime,
                counts,
                addOns: addOnQty,
                departureId: selectedDepartureId,
                quoteId: quote?.quoteId ?? null,
                currency: currency ?? null,
            });
            // Document navigation, for the same reason the hops OUT of checkout
            // use it: the checkout route is per-tour and only one tour per
            // destination is prerendered, so the client router's flight request
            // is answered with the HTML document, discarded, and turned into a
            // browser navigation anyway - just several hundred ms later, after
            // a wasted ~180 KB fetch. See `lib/checkout/leave-to.ts`.
            setNavigating(true);
            leaveTo(query ? `${checkoutBase}?${query}` : checkoutBase);
            return;
        }
        if (options?.onIncomplete) {
            options.onIncomplete();
            return;
        }
        handleCtaClick();
    }

    return { navigating, onCta };
}
