import { describe, expect, it } from 'vitest';
import { DUMMY_BOOKING_DATA, type TourBookingData } from '@/lib/tours/booking';
import { createBookingStore, deriveBooking } from './booking-store';

/**
 * LD5 trust-strip line 2 - "Pay only {pct}% today, the rest later".
 *
 * It promises a payment term, so it may only appear where that term is real.
 * Master conflict log 81 / B.81 locks the strip to the single cancellation line
 * on `paid_in_full` and `operator_full`; the client (Pastel #32) asked for the
 * same thing after seeing it promised unconditionally.
 *
 * These lock the truth table, including the two ways a deposit MODEL can still
 * fail to take a deposit (0% and 100%), which is where the old gate leaked.
 */

/**
 * Only the trust-line keys matter here; the cast stands in for the ~60 other
 * strings the widget reads, none of which this derivation touches. Copy is the
 * real English wording so a placeholder that stops being substituted shows up
 * as a failure rather than passing on `{pct}`.
 */
const dict = {
    payLater: '{link}, the rest later',
    payLaterLink: 'Pay only {pct}% today',
} as unknown as Parameters<typeof createBookingStore>[0]['dict'];

/**
 * Mirrors `toTourBookingData` in `lib/tours/booking.ts`: `requiresDeposit` is
 * derived there, never sent by a caller, so a fixture that sets it by hand
 * would test a state the app cannot produce.
 */
function tourWith(
    paymentModel: TourBookingData['paymentModel'],
    depositPct: number
): TourBookingData {
    const splitsPayment =
        paymentModel === 'OPERATOR_LINK' || paymentModel === 'ON_ARRIVAL';
    return {
        ...DUMMY_BOOKING_DATA,
        paymentModel,
        depositPct,
        requiresDeposit: splitsPayment && depositPct > 0 && depositPct < 100,
    };
}

const trustLineFor = (data: TourBookingData) =>
    deriveBooking(createBookingStore({ dict, data }).getState()).paymentTrust;

describe('booking widget payment trust line', () => {
    it('shows the tour real deposit percentage on operator_link', () => {
        const trust = trustLineFor(tourWith('OPERATOR_LINK', 30));

        expect(trust).not.toBeNull();
        expect(trust?.link).toBe('Pay only 30% today');
        expect(trust?.after).toBe(', the rest later');
    });

    it('takes the percentage from data, never a constant', () => {
        // Every tier rate is a real tour's rate; none may be baked into copy.
        expect(trustLineFor(tourWith('OPERATOR_LINK', 20))?.link).toBe(
            'Pay only 20% today'
        );
        expect(trustLineFor(tourWith('OPERATOR_LINK', 25))?.link).toBe(
            'Pay only 25% today'
        );
    });

    it('keeps the half-step rates intact', () => {
        // Tiers run 20-30 in steps of 2.5 (master LD24). Rounding 27.5 to 28
        // both misstated the term and put the widget half a percent away from
        // the server quote.
        expect(trustLineFor(tourWith('OPERATOR_LINK', 27.5))?.link).toBe(
            'Pay only 27.5% today'
        );
        expect(trustLineFor(tourWith('OPERATOR_LINK', 22.5))?.link).toBe(
            'Pay only 22.5% today'
        );
    });

    it('uses the same neutral tail on on_arrival', () => {
        // The line must not name HOW the balance is collected - it is not
        // always a link, and it is not always on arrival. That belongs in the
        // deposit modal.
        const trust = trustLineFor(tourWith('ON_ARRIVAL', 20));

        expect(trust?.link).toBe('Pay only 20% today');
        expect(trust?.after).toBe(', the rest later');
    });

    it('shows no payment line when the tour is paid in full', () => {
        // Was a plain "Pay in full now" row - a second line where master allows
        // only the cancellation one.
        expect(trustLineFor(tourWith('PAID_IN_FULL', 100))).toBeNull();
    });

    it('shows no payment line when the operator settles it', () => {
        expect(trustLineFor(tourWith('OPERATOR_FULL', 0))).toBeNull();
    });

    it('shows no payment line when a deposit model takes no deposit', () => {
        // Fail closed: "Pay only 0% today" and "Pay only 100% today, the rest
        // later" are both promises we cannot honour.
        expect(trustLineFor(tourWith('OPERATOR_LINK', 0))).toBeNull();
        expect(trustLineFor(tourWith('OPERATOR_LINK', 100))).toBeNull();
    });

    it('shows no payment line when the payment model is not recognised', () => {
        const unknown = tourWith(
            'SOMETHING_NEW' as TourBookingData['paymentModel'],
            30
        );

        expect(unknown.requiresDeposit).toBe(false);
        expect(trustLineFor(unknown)).toBeNull();
    });
});
