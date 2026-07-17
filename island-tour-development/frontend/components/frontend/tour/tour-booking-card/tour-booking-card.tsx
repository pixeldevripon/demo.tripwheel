'use client';

import { BookingStoreProvider } from '@/contexts/booking-context';
import { useAvailabilitySync } from '@/hooks/tours/use-availability-sync';
import { useBooking } from '@/hooks/tours/use-booking';
import { useBookingQuote } from '@/hooks/tours/use-booking-quote';
import type { Currency } from '@/lib/constants/locales';
import type { TourBookingData, TourBookingDict } from '@/lib/tours/booking';
import { BookingCalendar } from './booking-calendar';
import { BookingCta } from './booking-cta';
import { DepartureTimes } from './departure-times';
import { PartySelector } from './party-selector';
import { PolicyModal } from './policy-modal';
import { PriceHeader } from './price-header';
import { SellOutNotice } from './sell-out-notice';
import { SpectatorsPanel } from './spectators-panel';

export type { PolicyModalDict, TourBookingDict } from '@/lib/tours/booking';

/**
 * Card layout - every section reads its own slice from the booking store, so
 * this only arranges them and wires the two policy modals (opened from the trust
 * lines) to the shared `policyModal` state.
 */
function TourBookingCardLayout() {
    const { dict, policyModal, setPolicyModal, fillPolicy } = useBooking();
    // Loads the month calendar + per-date slots from the backend (no-op in demo).
    useAvailabilitySync();
    // Fetches the server-authoritative quote for the live selection (no-op in demo).
    useBookingQuote();

    return (
        <div className='flex flex-col gap-4'>
            {/* Main booking card — a viewport-capped flex column (mirrors the
                tours filter modal): the price header and CTA stay pinned while the
                middle selector stack scrolls with the thin hover scrollbar, so the
                sticky rail never pushes the CTA below the fold on short screens.
                The cap applies only where the card is sticky (lg+); on mobile it
                flows naturally with no inner scroll. */}
            <div className='flex flex-col rounded-[16px] bg-it-surface lg:max-h-[calc(100vh-7rem)]'>
                {/* Price header — never scrolls */}
                <div className='shrink-0'>
                    <PriceHeader />
                </div>

                {/* Selectors — the only scroll region (thin hover scrollbar);
                    min-h-0 + flex-1 lets overflow trigger inside the flex column.
                    The calendar popover opens at the top, so it clears the fold. */}
                <div className='it-modal-scroll flex min-h-0 flex-1 flex-col gap-2 px-4 pt-4'>
                    {/* Calendar + slots share one flex cell: the slots' top gap
                        lives INSIDE their collapse (pt-2), so it animates with
                        the height tween instead of the parent gap snapping in
                        the moment the block mounts. */}
                    <div>
                        <BookingCalendar />
                        <DepartureTimes />
                    </div>
                    <PartySelector />
                    <SpectatorsPanel />
                </div>

                {/* CTA + trust lines — pinned footer, always reachable */}
                <div className='shrink-0 px-4 pb-4 pt-6'>
                    <BookingCta />
                </div>
            </div>

            {/* "Likely to sell out" notice — flows below the capped card */}
            <SellOutNotice />

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
}: {
    dict: TourBookingDict;
    /** Live tour data; falls back to `DUMMY_BOOKING_DATA` for design/testing. */
    data?: TourBookingData;
    locale?: string;
    /** Live tour id; enables real availability (calendar + per-date slots). Omit
     *  for the design/demo card (static start times, always-open calendar). */
    tourId?: string;
    /** Destination + tour slug so "Continue" can route to the checkout page. */
    destinationSlug?: string;
    tourSlug?: string;
    /** Shopper display/booking currency; sent to the quote + carried to checkout. */
    currency?: Currency;
}) {
    return (
        <BookingStoreProvider
            dict={dict}
            data={data}
            locale={locale}
            tourId={tourId}
            destinationSlug={destinationSlug}
            tourSlug={tourSlug}
            currency={currency}>
            <TourBookingCardLayout />
        </BookingStoreProvider>
    );
}
