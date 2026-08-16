import {
    createPaymentIntent,
    reserveBooking,
    updateBookingContact,
    type ReserveRequest,
} from '@/lib/api/bookings';
import type { BookingSelectionPayload } from '@/lib/checkout/checkout';
import { composePhone } from '@/lib/checkout/countries';
import type { Currency, Locale } from '@/lib/constants/locales';
import { readAttribution } from '@/lib/tracking/attribution';
import {
    reconcileTravellerIdentity,
    storeTravelerSession,
} from '@/lib/traveler-booking';

/**
 * The reserve -> contact -> session -> payment-intent transaction.
 *
 * WHY THIS IS NOT IN THE COMPONENT. It was a 105-line closure inside
 * `CheckoutForm`, over component state, with no JSX in it and only four React
 * touchpoints. It is the highest-consequence code in the checkout - it claims
 * seats, moves the traveller's session, and sets up a charge - and while it
 * lived in that closure there was NO WAY TO TEST IT. Out here it takes a typed
 * input and returns a discriminated result, so every branch (including the ones
 * that are painful to reach in a browser: a Mollie profile that never arrives,
 * a Stripe intent missing its client secret, a backend 500) is a unit test.
 *
 * The component keeps exactly what is React's job: the error message, the
 * intent, the phase, and the navigation.
 *
 * ORDER IS LOAD-BEARING and is preserved verbatim from the original:
 *
 * 1. `reserveBooking` - idempotent on `id`, so a retry does not double-book.
 * 2. `updateBookingContact` - the ONLY call that mints the traveler session.
 * 3. `storeTravelerSession` is AWAITED before anything navigates, so the TYP
 *    renders verified on its very first load. The booker's email rides along so
 *    the route can refuse a scope DOWNGRADE (report 2026-08-01 §Traveler.4).
 * 4. `reconcileTravellerIdentity` - the navbar reads a separate client-readable
 *    cookie; without this the header still named whoever was signed in BEFORE.
 * 5. `createPaymentIntent` last, because it needs the booking to exist.
 */

/** What the caller must supply. Everything here is already validated. */
export interface ReserveAndPayInput {
    /** Client idempotency key - a retry with the same value replays. */
    bookingId: string;
    tourId: string;
    departureId: string;
    currency: Currency;
    quoteId?: string | null;
    /** From `buildBookingSelection` - the shared quote/reserve party payload. */
    selection: BookingSelectionPayload;
    addOns: ReserveRequest['addOns'];
    /** Already mapped from the pickup select. */
    pickup: Pick<ReserveRequest, 'pickupRequested' | 'pickupLocationId'>;
    locale: Locale;
    contact: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        special: string;
    };
    /**
     * Operator-conditions gate (Pastel #80): stop BEFORE the payment-intent
     * leg. Set for a flagged tour whose acceptance is not recorded yet - the
     * backend 422s the intent without it, so the checkout collects the tick
     * first and then runs `intentForBooking` on its own.
     */
    deferIntent?: boolean;
}

export type ReserveAndPayResult =
    | {
          kind: 'stripe';
          publicRef: string;
          clientSecret: string;
          publishableKey: string;
          methodTypes: string[];
          amount: number | null;
      }
    | {
          kind: 'mollie';
          publicRef: string;
          bookingId: string;
          profileId: string | null;
          testmode: boolean;
          amount: number | null;
      }
    /** Nothing due now (OPERATOR_FULL is born CONFIRMED at reserve). */
    | { kind: 'noPayment'; publicRef: string }
    /** A charge IS due but the PSP payload was unusable - show `paymentUnavailable`. */
    | { kind: 'paymentUnavailable' }
    /** Reserved + contact saved, intent DEFERRED behind the operator-conditions
     *  tick (Pastel #80). The checkout runs `intentForBooking` after acceptance. */
    | { kind: 'termsPending'; publicRef: string; bookingId: string }
    /** `message` is null when the raw error is not worth showing a traveller. */
    | { kind: 'error'; message: string | null };

/**
 * Turn a thrown error into something worth showing.
 *
 * A bare "Internal server error" tells a traveller nothing actionable, so it is
 * suppressed in favour of the caller's own copy; anything else the backend says
 * (already requested, departure full, not confirmed) explains the refusal and
 * is worth relaying. Returns null to mean "use your fallback".
 */
export function userFacingError(err: unknown): string | null {
    const raw = err instanceof Error ? err.message : '';
    if (!raw) return null;
    return /internal server error/i.test(raw) ? null : raw;
}

export async function reserveAndPay(
    input: ReserveAndPayInput
): Promise<ReserveAndPayResult> {
    const { contact } = input;
    try {
        const booking = await reserveBooking({
            id: input.bookingId,
            tourId: input.tourId,
            departureId: input.departureId,
            currency: input.currency,
            quoteId: input.quoteId ?? undefined,
            ...input.selection,
            ...(input.addOns && input.addOns.length > 0
                ? { addOns: input.addOns }
                : {}),
            ...input.pickup,
            notes: contact.special.trim() || undefined,
            // Ad click ids + UTM captured on the landing page (master 8.1.6);
            // written onto the booking on first reserve only.
            attribution: readAttribution() ?? undefined,
        });

        const withContact = await updateBookingContact(
            booking.id,
            {
                firstName: contact.firstName.trim(),
                lastName: contact.lastName.trim(),
                email: contact.email.trim(),
                phone: composePhone(contact.country, contact.phone) || undefined,
                country: contact.country || undefined,
                locales: [input.locale],
            },
            contact.special.trim() || undefined
        );

        const bookerEmail = contact.email.trim();
        if (withContact.sessionToken) {
            await storeTravelerSession(withContact.sessionToken, bookerEmail);
        }
        reconcileTravellerIdentity(bookerEmail);

        if (input.deferIntent) {
            return {
                kind: 'termsPending',
                publicRef: booking.publicRef,
                bookingId: booking.id,
            };
        }

        return await intentForBooking(booking.id, booking.publicRef);
    } catch (err) {
        // Logged raw for debugging; the caller decides what the traveller reads.
        console.error('[checkout] reserve/pay failed:', err);
        return { kind: 'error', message: userFacingError(err) };
    }
}

/**
 * The payment-intent leg alone - `reserveAndPay`'s own tail, exported so the
 * operator-conditions gate can run it AFTER the acceptance tick (the reserve
 * and contact legs already ran with `deferIntent`). One implementation: the
 * result mapping cannot drift between the two entry points.
 */
export async function intentForBooking(
    bookingId: string,
    publicRef: string
): Promise<ReserveAndPayResult> {
    try {
        const pi = await createPaymentIntent(bookingId);
        const amount = pi.amount != null ? Number(pi.amount) : null;

        if (!pi.paymentRequired) {
            return { kind: 'noPayment', publicRef };
        }
        if (pi.provider === 'MOLLIE') {
            return {
                kind: 'mollie',
                publicRef,
                bookingId,
                profileId: pi.profileId ?? null,
                testmode: pi.testmode ?? false,
                amount,
            };
        }
        if (!pi.clientSecret || !pi.publishableKey) {
            return { kind: 'paymentUnavailable' };
        }
        return {
            kind: 'stripe',
            publicRef,
            clientSecret: pi.clientSecret,
            publishableKey: pi.publishableKey,
            methodTypes: pi.paymentMethodTypes ?? [],
            amount,
        };
    } catch (err) {
        console.error('[checkout] intent failed:', err);
        return { kind: 'error', message: userFacingError(err) };
    }
}
