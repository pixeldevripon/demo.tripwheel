'use client';

import { BookingStoreProvider } from '@/contexts/booking-context';
import { useAvailabilitySync } from '@/hooks/tours/use-availability-sync';
import { useBooking } from '@/hooks/tours/use-booking';
import { useBookingQuote } from '@/hooks/tours/use-booking-quote';
import { useBookingSelectionPersistence } from '@/hooks/tours/use-booking-selection-persistence';
import type { Currency, Locale } from '@/lib/constants/locales';
import type { TourBookingData, TourBookingDict } from '@/lib/tours/booking';
import { AvailabilityDeadEnd } from './availability-dead-end';
import { BookingAddOns } from './booking-add-ons';
import { BookingCalendar } from './booking-calendar';
import { BookingCta } from './booking-cta';
import { DepartureTimes } from './departure-times';
import { PartySelector } from './party-selector';
import { PolicyModal } from './policy-modal';
import { PriceHeader } from './price-header';
import { BookingNotices } from './booking-notices';
import { SpectatorsPanel } from './spectators-panel';

export type { PolicyModalDict, TourBookingDict } from '@/lib/tours/booking';

/**
 * Card layout - every section reads its own slice from the booking store, so
 * this only arranges them and wires the two policy modals (opened from the trust
 * lines) to the shared `policyModal` state.
 */
function TourBookingCardLayout() {
    const {
        dict,
        policyModal,
        setPolicyModal,
        fillPolicy,
        availabilityDeadEnd,
    } = useBooking();
    // Loads the month calendar + per-date slots from the backend (no-op in demo).
    useAvailabilitySync();
    // Fetches the server-authoritative quote for the live selection (no-op in demo).
    useBookingQuote();
    // Restores the traveller's selection after a checkout round-trip and keeps
    // the sessionStorage snapshot current (no-op in demo).
    useBookingSelectionPersistence();

    return (
        <div className='flex flex-col gap-3.5'>
            {/* Main booking card — a viewport-capped flex column (mirrors the
                tours filter modal): the price header and the CTA stay pinned,
                and EVERYTHING the traveller fills in between them - date,
                departure slots, party, spectators, extras - lives in one scroll
                region with the thin hover scrollbar. One region, not two: a
                pinned date/slot block above a second scroller made the party
                rows slide under the chips and cost the selectors the height
                they need. The cap applies only where the card is sticky (lg+);
                on mobile it flows naturally with no inner scroll.

                The cap sits HERE and not on the sticky rail: with it on the
                rail, the card and the notices below it competed for one
                viewport, and on a 720px screen the notices (which cannot
                scroll or shrink) crushed the card past its own contents until
                the CTA spilled out and printed over them. Capping the card
                alone means the card is always whole and the notices simply
                take whatever is left, coming back into view when the rail
                releases at the end of the page. */}
            <div className='flex flex-col rounded-it-lg border border-it-border bg-it-white shadow-it-md lg:max-h-[calc(100vh-7rem)]'>
                {/* Price header — never scrolls */}
                <div className='shrink-0'>
                    <PriceHeader />
                </div>

                {/* Selectors — the only scroll region (thin hover scrollbar);
                    min-h-0 + flex-1 lets overflow trigger inside the flex column.
                    The calendar popover is portalled to the body, so it is not
                    clipped by this container.
                    `it-modal-scroll-lg-only` drops the scroll container below lg,
                    where the card is uncapped: an overflow:auto box that never
                    overflows still swallows touch drags via overscroll-contain,
                    which made this whole block a dead zone on mobile.

                    The `min-h` floor keeps this usable on a short screen, where
                    the card's cap leaves little between the pinned header and
                    the pinned CTA - without it the region collapsed to a sliver
                    and the traveller saw a price and a button with nothing
                    operable in between. It yields to `25vh` rather than sitting
                    at a flat 220px so that it can never demand more than the
                    cap allows: a floor taller than the cap would push the CTA
                    out through the bottom of the card and over the notices.

                    Deliberately a BLOCK inside (`space-y-2`, not `flex-col` +
                    `gap-2`): as flex items in a height-constrained column the
                    panels shrank to fit instead of overflowing, and since
                    <Collapse> clips with overflow-hidden, the spectators panel
                    lost everything below its title - reachable by no amount of
                    scrolling, because there was no overflow to scroll. Block
                    children keep their height, so the region overflows and the
                    scrollbar is what resolves it. */}
                <div className='it-modal-scroll it-modal-scroll-lg-only min-h-0 flex-1 space-y-2 px-4 pt-4 lg:min-h-[min(220px,25vh)]'>
                    {availabilityDeadEnd ? (
                        /* All-sold-out recovery (AVAILABILITY-AND-DEPARTURES.md
                           §8). The whole selector stack is replaced, not just
                           the calendar: with no open departure in 30 days a date
                           field, time chips, party steppers and a Continue
                           button are all dead controls, and leaving them there
                           is what makes a blank calendar feel broken. */
                        <AvailabilityDeadEnd />
                    ) : (
                        <>
                            {/* Calendar + slots share one block: the slots' top
                                gap lives INSIDE their collapse (pt-2), so it
                                animates with the height tween instead of a
                                sibling margin snapping in the moment the block
                                mounts. */}
                            <div>
                                <BookingCalendar />
                                <DepartureTimes />
                            </div>
                            <PartySelector />
                            <SpectatorsPanel />
                            {/* Optional extras (master E.3) - after the party,
                                before the pinned CTA; hidden when the tour has
                                none. */}
                            <BookingAddOns />
                        </>
                    )}
                </div>

                {/* CTA + trust lines — pinned footer, always reachable. Gone in
                    the dead end: there is nothing to continue to. */}
                {!availabilityDeadEnd && (
                    <div className='shrink-0 px-4 pb-4 pt-6'>
                        <BookingCta />
                    </div>
                )}
            </div>

            {/* Earned notices (sell-out / most popular / sponsored) — flow
                below the capped card. Renders nothing when the tour has none. */}
            <BookingNotices />

            {/* Policy detail modals (opened from the trust lines) */}
            <PolicyModal
                open={policyModal === 'cancellation'}
                onClose={() => setPolicyModal(null)}
                content={dict.cancellationModal}
                closeLabel={dict.policyClose}
                fill={fillPolicy}
            />
            <PolicyModal
                open={policyModal === 'deposit'}
                onClose={() => setPolicyModal(null)}
                content={dict.depositModal}
                closeLabel={dict.policyClose}
                fill={fillPolicy}
            />
        </div>
    );
}

/**
 * Tour booking card - the interactive right-rail widget (Figma "Booking Widget
 * V2", node 49213:8098). Drives the full pre-checkout flow client-side:
 *
 *  1. Price header (From {price} per person).
 *  2. Date field -> full-month calendar popover.
 *  3. Departure-time chips (appear once a date is picked).
 *  4. Party selector - Pattern A (single band: inline stepper) or Pattern B
 *     (age-banded: expandable steppers + optional spectators + Apply).
 *  5. Price summary (Total / Pay today / Balance later) once date + time + party
 *     are set, expandable to a per-band line-item breakdown.
 *  6. Continue CTA (label switches from "Check Availability" once ready) + two
 *     trust lines, and a "Likely to sell out" notice beneath the card.
 *
 * The coordinated flow state lives in a per-card Zustand store, provided by
 * `BookingStoreProvider`; each section pulls its own slice via `useBooking()`.
 * Real availability (remaining spots / sold-out slots) and checkout navigation
 * land with the booking module; every offered start time is selectable for now.
 */
export function TourBookingCard({
    dict,
    data,
    locale = 'en',
    tourId,
    destinationSlug,
    tourSlug,
    currency,
    initialDate,
}: {
    dict: TourBookingDict;
    /** Live tour data; falls back to `DUMMY_BOOKING_DATA` for design/testing. */
    data?: TourBookingData;
    locale?: Locale;
    /** Live tour id; enables real availability (calendar + per-date slots). Omit
     *  for the design/demo card (static start times, always-open calendar). */
    tourId?: string;
    /** Destination + tour slug so "Continue" can route to the checkout page. */
    destinationSlug?: string;
    tourSlug?: string;
    /** Shopper display/booking currency; sent to the quote + carried to checkout. */
    currency?: Currency;
    /**
     * A day the traveller already chose upstream (`?date=` in the URL, carried
     * from a date-filtered search or listing). Preselected here so they are not
     * asked the same question twice; the calendar stays fully editable.
     */
    initialDate?: string;
}) {
    return (
        <BookingStoreProvider
            dict={dict}
            data={data}
            locale={locale}
            tourId={tourId}
            destinationSlug={destinationSlug}
            tourSlug={tourSlug}
            currency={currency}
            initialDate={initialDate}>
            <TourBookingCardLayout />
        </BookingStoreProvider>
    );
}
