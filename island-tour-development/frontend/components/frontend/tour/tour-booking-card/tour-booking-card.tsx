'use client';

import { BookingStoreProvider } from '@/contexts/booking-context';
import { useAvailabilitySync } from '@/hooks/tours/use-availability-sync';
import { useBooking } from '@/hooks/tours/use-booking';
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

    return (
        <div className='flex flex-col gap-4'>
            {/* Main booking card */}
            <div className='rounded-[16px] bg-it-surface'>
                <PriceHeader />

                {/* Content: selectors + CTA */}
                <div className='flex flex-col gap-6 p-4'>
                    <div className='flex flex-col gap-2'>
                        <BookingCalendar />
                        <DepartureTimes />
                        <PartySelector />
                        <SpectatorsPanel />
                    </div>
                    <BookingCta />
                </div>
            </div>

            {/* "Likely to sell out" notice */}
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
}) {
    return (
        <BookingStoreProvider
            dict={dict}
            data={data}
            locale={locale}
            tourId={tourId}
            destinationSlug={destinationSlug}
            tourSlug={tourSlug}>
            <TourBookingCardLayout />
        </BookingStoreProvider>
    );
}
