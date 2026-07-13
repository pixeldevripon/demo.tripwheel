/**
 * Thank-you page (TYP) data layer. Mirrors the public TYP lookup contract
 * (BOOKING-FLOW-DESIGN-GUIDE.md §12: `GET /api/v1/bookings/typ/:publicRef`,
 * keyed by the unguessable `publicRef`; `displayRef` is customer-facing).
 *
 * DEMO ONLY until the booking module lands: `getThankYouBooking` returns a
 * fixed payload (the Figma 47744-9184 demo booking) for `DEMO_PUBLIC_REF` and
 * null otherwise. Swap the body for `publicGet('/bookings/typ/' + publicRef)`
 * when the endpoint exists - the lookup stays UNCACHED (per-traveller data).
 */
import type { TourListing } from '@/components/frontend/tour-card';

/** Demo TYP token - checkout's demo reserve flow redirects here. */
export const DEMO_PUBLIC_REF = 'pr-demo-2026-04821';

export interface ThankYouPayment {
    currencySymbol: string;
    total: number;
    /** Deposit already collected by Island Tours; 0 = nothing paid online. */
    depositPaid: number;
    depositPct: number;
    /** Operator-collected remainder; 0 = paid in full. */
    balance: number;
    balancePct: number;
    /** e.g. "Mastercard *****4242" - how the deposit was paid. */
    cardLabel: string;
    /** Local date the operator balance is due ("Sat 25 May, 2026"). */
    payBeforeLabel: string;
    /** Short variant for the next-steps strip ("tue, 19 May"). */
    payBeforeShort: string;
}

export interface ThankYouApartment {
    eyebrowArea: string;
    name: string;
    rating: number;
    reviewCount: number;
    sleeps: number;
    pricePerNight: number;
    descriptionLines: string[];
    image: string;
    airbnbUrl: string;
}

export interface ThankYouBooking {
    publicRef: string;
    displayRef: string;
    status: 'CONFIRMED';
    guestFirstName: string;
    guestLead: string;
    guestEmail: string;
    tourTitle: string;
    destinationSlug: string;
    dateLabel: string;
    startTimeLabel: string;
    timeRangeLabel: string;
    durationLabel: string;
    pickupLabel: string;
    freeCancelBeforeLabel: string;
    partyLabel: string;
    operatorName: string;
    /** Casual short name used in payment copy ("Miss ann will email you..."). */
    operatorShortName: string;
    operatorEmail: string;
    operatorPhone: string;
    supportEmail: string;
    payment: ThankYouPayment;
    /** ISO start/end used for the add-to-calendar link. */
    startsAtIso: string;
    endsAtIso: string;
    /**
     * Conversion value in EUR (critical rule 22: `commission_amount`, never
     * GMV). A CONFIRMED booking with null commission is data corruption - the
     * tracking module must fire NO conversion for it.
     */
    commissionAmountEur: number | null;
    relatedTours: TourListing[];
    apartment: ThankYouApartment;
}

const DEMO_BOOKING: ThankYouBooking = {
    publicRef: DEMO_PUBLIC_REF,
    displayRef: 'IT-2026-04821',
    status: 'CONFIRMED',
    guestFirstName: 'Denley',
    guestLead: 'Denley Smith',
    guestEmail: 'denley@example.com',
    tourTitle: 'Klein Curaçao day Trip',
    destinationSlug: 'curacao',
    dateLabel: 'Tue 28 May, 2026',
    startTimeLabel: '8:00 AM',
    timeRangeLabel: '8:00 AM - 5:00 PM',
    durationLabel: '9 hour',
    pickupLabel: 'At your accom',
    freeCancelBeforeLabel: 'Sunday, 26 May',
    partyLabel: '2 adults, 1 child',
    operatorName: 'Miss Ann Boat Trips',
    operatorShortName: 'Miss ann',
    operatorEmail: 'reservation@missannboattrips.com',
    operatorPhone: '+599 9 123 4567',
    supportEmail: 'reservations@island.tours',
    payment: {
        currencySymbol: '$',
        total: 200,
        depositPaid: 40,
        depositPct: 20,
        balance: 160,
        balancePct: 80,
        cardLabel: 'Mastercard *****4242',
        payBeforeLabel: 'Sat 25 May, 2026',
        payBeforeShort: 'tue, 19 May',
    },
    startsAtIso: '2026-05-28T08:00:00',
    endsAtIso: '2026-05-28T17:00:00',
    commissionAmountEur: 40,
    relatedTours: [
        {
            id: 'typ-demo-adventure',
            images: ['https://picsum.photos/seed/typ-adventure/768/540'],
            badge: null,
            rating: 4.8,
            reviewCount: 1738,
            title: 'Adventure',
            duration: '4h',
            pickupAvailable: false,
            price: 89,
            priceUnit: 'per',
        },
        {
            id: 'typ-demo-boat-trip',
            images: ['https://picsum.photos/seed/typ-boat/768/540'],
            badge: null,
            rating: 4.8,
            reviewCount: 1738,
            title: 'Boat trip',
            duration: '3h',
            pickupAvailable: false,
            price: 65,
            priceUnit: 'per',
        },
        {
            id: 'typ-demo-cruise',
            images: ['https://picsum.photos/seed/typ-cruise/768/540'],
            badge: null,
            rating: 4.8,
            reviewCount: 1738,
            title: 'Cruise',
            duration: '3h',
            pickupAvailable: false,
            price: 75,
            priceUnit: 'per',
        },
    ],
    apartment: {
        eyebrowArea: 'Jan Thiel',
        name: 'Palm Suite Apartment',
        rating: 4.8,
        reviewCount: 1738,
        sleeps: 4,
        pricePerNight: 160,
        descriptionLines: [
            'Quiet, modern, 5min from the beach',
            'Owned and hosted by Island Tours',
        ],
        image: 'https://picsum.photos/seed/typ-apartment/1176/758',
        airbnbUrl: 'https://www.airbnb.com',
    },
};

/**
 * Public TYP lookup by `publicRef`. Uncached by design (per-traveller booking
 * data); callers await it inside a `<Suspense>` boundary after `connection()`.
 */
export async function getThankYouBooking(
    publicRef: string,
): Promise<ThankYouBooking | null> {
    // Demo stand-in for publicGet(`/bookings/typ/${publicRef}`) - unknown refs
    // 404 exactly like the real unguessable-token lookup will.
    return publicRef === DEMO_PUBLIC_REF ? DEMO_BOOKING : null;
}

/**
 * Google Calendar "add event" URL for the booked departure - the demo target
 * of the hero CTA until a proper multi-provider menu is designed.
 */
export function buildCalendarUrl(booking: ThankYouBooking): string {
    const compact = (iso: string) => iso.replace(/[-:]/g, '');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: booking.tourTitle,
        dates: `${compact(booking.startsAtIso)}/${compact(booking.endsAtIso)}`,
        details: `Booking ref: ${booking.displayRef}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
