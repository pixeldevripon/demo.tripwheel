import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reserve -> contact -> session -> payment-intent transaction: the code
 * that claims seats, moves the traveller's session and sets up a charge.
 *
 * These tests exist because this used to be a closure inside `CheckoutForm`,
 * where none of it could be reached. The branches that matter most here are the
 * ones that are painful to produce in a browser - a Mollie profile that never
 * arrives, a Stripe intent missing its client secret, a backend 500 - and each
 * of them decides whether a traveller can pay.
 */


const reserveBooking = vi.fn();
const updateBookingContact = vi.fn();
const createPaymentIntent = vi.fn();
vi.mock('@/lib/api/bookings', () => ({
    reserveBooking: (...a: unknown[]) => reserveBooking(...a),
    updateBookingContact: (...a: unknown[]) => updateBookingContact(...a),
    createPaymentIntent: (...a: unknown[]) => createPaymentIntent(...a),
}));

const storeTravelerSession = vi.fn();
const reconcileTravellerIdentity = vi.fn();
vi.mock('@/lib/traveler-booking', () => ({
    storeTravelerSession: (...a: unknown[]) => storeTravelerSession(...a),
    reconcileTravellerIdentity: (...a: unknown[]) =>
        reconcileTravellerIdentity(...a),
}));

const readAttribution = vi.fn();
vi.mock('@/lib/tracking/attribution', () => ({
    readAttribution: () => readAttribution(),
}));

vi.mock('@/lib/checkout/countries', () => ({
    composePhone: (country: string, phone: string) => `${country}${phone}`,
}));

const { reserveAndPay, intentForBooking, userFacingError } = await import(
    './reserve-and-pay'
);

const INPUT = {
    bookingId: 'bk-idem-1',
    tourId: 'tour-1',
    departureId: 'dep-1',
    currency: 'USD' as const,
    quoteId: 'quote-1',
    selection: { guests: 2 } as const,
    addOns: [],
    pickup: { pickupRequested: false },
    locale: 'en' as const,
    contact: {
        firstName: '  Ada  ',
        lastName: 'Lovelace',
        email: '  ada@example.com  ',
        phone: '5551234',
        country: '+1',
        special: '  window seat  ',
    },
};

const BOOKING = { id: 'booking-1', publicRef: 'BK-PUB-1' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reserveBooking.mockResolvedValue(BOOKING);
    updateBookingContact.mockResolvedValue({ sessionToken: 'v1.tok.sig' });
    readAttribution.mockReturnValue({ utmSource: 'google' });
    createPaymentIntent.mockResolvedValue({
        paymentRequired: true,
        provider: 'STRIPE',
        clientSecret: 'cs_1',
        publishableKey: 'pk_1',
        paymentMethodTypes: ['card'],
        amount: '150.00',
    });
});

describe('reserveAndPay - the happy paths', () => {
    it('returns the Stripe intent with the backend amount', async () => {
        const result = await reserveAndPay(INPUT);

        expect(result).toEqual({
            kind: 'stripe',
            publicRef: 'BK-PUB-1',
            clientSecret: 'cs_1',
            publishableKey: 'pk_1',
            methodTypes: ['card'],
            walletMethods: [],
            amount: 150,
        });
    });

    it('returns the Mollie profile, where no payment exists yet', async () => {
        createPaymentIntent.mockResolvedValue({
            paymentRequired: true,
            provider: 'MOLLIE',
            profileId: 'pfl_1',
            testmode: true,
            amount: '150.00',
        });

        expect(await reserveAndPay(INPUT)).toEqual({
            kind: 'mollie',
            publicRef: 'BK-PUB-1',
            bookingId: 'booking-1',
            profileId: 'pfl_1',
            testmode: true,
            amount: 150,
        });
    });

    it('reports no-payment for a booking with nothing due (OPERATOR_FULL)', async () => {
        createPaymentIntent.mockResolvedValue({ paymentRequired: false });

        expect(await reserveAndPay(INPUT)).toEqual({
            kind: 'noPayment',
            publicRef: 'BK-PUB-1',
        });
    });
});

describe('reserveAndPay - the request it builds', () => {
    it('sends the client idempotency key, so a retry replays', async () => {
        await reserveAndPay(INPUT);
        expect(reserveBooking).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'bk-idem-1' }),
        );
    });

    it('spreads the shared selection payload rather than rebuilding it', async () => {
        await reserveAndPay(INPUT);
        expect(reserveBooking).toHaveBeenCalledWith(
            expect.objectContaining({ guests: 2 }),
        );
    });

    it('omits addOns entirely when none are chosen', async () => {
        await reserveAndPay(INPUT);
        expect(reserveBooking.mock.calls[0][0]).not.toHaveProperty('addOns');
    });

    it('sends addOns when there are some', async () => {
        await reserveAndPay({
            ...INPUT,
            addOns: [{ addOnId: 'a1', quantity: 2 }],
        });
        expect(reserveBooking).toHaveBeenCalledWith(
            expect.objectContaining({ addOns: [{ addOnId: 'a1', quantity: 2 }] }),
        );
    });

    it('trims the notes, and omits them when blank', async () => {
        await reserveAndPay(INPUT);
        expect(reserveBooking.mock.calls[0][0].notes).toBe('window seat');

        vi.clearAllMocks();
        reserveBooking.mockResolvedValue(BOOKING);
        updateBookingContact.mockResolvedValue({});
        createPaymentIntent.mockResolvedValue({ paymentRequired: false });
        await reserveAndPay({
            ...INPUT,
            contact: { ...INPUT.contact, special: '   ' },
        });
        expect(reserveBooking.mock.calls[0][0].notes).toBeUndefined();
    });

    it('attaches the captured attribution', async () => {
        await reserveAndPay(INPUT);
        expect(reserveBooking.mock.calls[0][0].attribution).toEqual({
            utmSource: 'google',
        });
    });

    it('omits attribution when none was captured', async () => {
        readAttribution.mockReturnValue(null);
        await reserveAndPay(INPUT);
        expect(reserveBooking.mock.calls[0][0].attribution).toBeUndefined();
    });

    it('trims the contact fields', async () => {
        await reserveAndPay(INPUT);
        expect(updateBookingContact).toHaveBeenCalledWith(
            'booking-1',
            expect.objectContaining({
                firstName: 'Ada',
                email: 'ada@example.com',
                locales: ['en'],
            }),
            'window seat',
        );
    });
});

describe('reserveAndPay - the session hand-off', () => {
    it('AWAITS the session store before returning', async () => {
        // The TYP must render verified on its first load. A fire-and-forget
        // store here races the navigation that follows.
        const order: string[] = [];
        storeTravelerSession.mockImplementation(async () => {
            await Promise.resolve();
            order.push('session');
        });
        createPaymentIntent.mockImplementation(async () => {
            order.push('intent');
            return { paymentRequired: false };
        });

        await reserveAndPay(INPUT);

        expect(order).toEqual(['session', 'intent']);
    });

    it('passes the booker email so the route can refuse a scope DOWNGRADE', async () => {
        // Report 2026-08-01 §Traveler.4: overwriting a signed-in traveller's
        // account session with this booking-scoped token logged them out the
        // moment they booked.
        await reserveAndPay(INPUT);
        expect(storeTravelerSession).toHaveBeenCalledWith(
            'v1.tok.sig',
            'ada@example.com',
        );
    });

    it('skips the store when the backend issued no token', async () => {
        updateBookingContact.mockResolvedValue({});
        await reserveAndPay(INPUT);
        expect(storeTravelerSession).not.toHaveBeenCalled();
    });

    it('always reconciles the navbar identity, token or not', async () => {
        // The chrome reads a separate client-readable cookie; without this the
        // header kept naming whoever was signed in BEFORE the booking.
        updateBookingContact.mockResolvedValue({});
        await reserveAndPay(INPUT);
        expect(reconcileTravellerIdentity).toHaveBeenCalledWith('ada@example.com');
    });
});

describe('reserveAndPay - failure branches', () => {
    it('reports paymentUnavailable when Stripe returns no client secret', async () => {
        createPaymentIntent.mockResolvedValue({
            paymentRequired: true,
            provider: 'STRIPE',
            publishableKey: 'pk_1',
        });
        expect(await reserveAndPay(INPUT)).toEqual({ kind: 'paymentUnavailable' });
    });

    it('reports paymentUnavailable when Stripe returns no publishable key', async () => {
        createPaymentIntent.mockResolvedValue({
            paymentRequired: true,
            provider: 'STRIPE',
            clientSecret: 'cs_1',
        });
        expect(await reserveAndPay(INPUT)).toEqual({ kind: 'paymentUnavailable' });
    });

    it('relays a backend message that explains the refusal', async () => {
        reserveBooking.mockRejectedValue(new Error('Not enough availability'));
        expect(await reserveAndPay(INPUT)).toEqual({
            kind: 'error',
            message: 'Not enough availability',
        });
    });

    it('suppresses a bare 500, which tells a traveller nothing', async () => {
        reserveBooking.mockRejectedValue(new Error('Internal server error'));
        expect(await reserveAndPay(INPUT)).toEqual({
            kind: 'error',
            message: null,
        });
    });

    it('survives a failure at ANY step of the transaction', async () => {
        for (const step of [
            reserveBooking,
            updateBookingContact,
            createPaymentIntent,
        ]) {
            vi.clearAllMocks();
            reserveBooking.mockResolvedValue(BOOKING);
            updateBookingContact.mockResolvedValue({ sessionToken: 't' });
            createPaymentIntent.mockResolvedValue({ paymentRequired: false });
            step.mockRejectedValue(new Error('boom'));

            expect(await reserveAndPay(INPUT)).toEqual({
                kind: 'error',
                message: 'boom',
            });
        }
    });

    it('does not create a payment intent when the reserve failed', async () => {
        reserveBooking.mockRejectedValue(new Error('boom'));
        await reserveAndPay(INPUT);
        expect(createPaymentIntent).not.toHaveBeenCalled();
    });
});

/**
 * Pastel #80: a flagged tour's intent is DEFERRED behind the operator-
 * conditions tick - the backend 422s it without the recorded acceptance, so
 * the reserve stops early and the gate arms the intent leg on its own.
 */
describe('reserveAndPay - operator-conditions gate (Pastel #80)', () => {
    it('deferIntent stops before the intent leg and returns termsPending', async () => {
        const result = await reserveAndPay({ ...INPUT, deferIntent: true });

        expect(result).toEqual({
            kind: 'termsPending',
            publicRef: 'BK-PUB-1',
            bookingId: 'booking-1',
        });
        expect(createPaymentIntent).not.toHaveBeenCalled();
        // The reserve/contact/session legs still ran in full - the traveller
        // is signed in and the seats are held either way.
        expect(reserveBooking).toHaveBeenCalled();
        expect(storeTravelerSession).toHaveBeenCalled();
    });
});

describe('intentForBooking - the deferred intent leg', () => {
    it('maps the Stripe intent exactly like the inline tail', async () => {
        const result = await intentForBooking('booking-1', 'BK-PUB-1');

        expect(result).toEqual({
            kind: 'stripe',
            publicRef: 'BK-PUB-1',
            clientSecret: 'cs_1',
            publishableKey: 'pk_1',
            methodTypes: ['card'],
            walletMethods: [],
            amount: 150,
        });
        // The intent leg alone: it must never re-reserve or touch contact.
        expect(reserveBooking).not.toHaveBeenCalled();
        expect(updateBookingContact).not.toHaveBeenCalled();
    });

    it('relays a thrown intent refusal (the 422 without acceptance)', async () => {
        createPaymentIntent.mockRejectedValue(
            new Error(
                'Accept the operator conditions before paying for this booking',
            ),
        );
        const result = await intentForBooking('booking-1', 'BK-PUB-1');
        expect(result).toEqual({
            kind: 'error',
            message:
                'Accept the operator conditions before paying for this booking',
        });
    });
});

describe('userFacingError', () => {
    it('passes through an actionable message', () => {
        expect(userFacingError(new Error('Departure is full'))).toBe(
            'Departure is full',
        );
    });

    it('suppresses a bare internal server error, case-insensitively', () => {
        expect(userFacingError(new Error('Internal server error'))).toBeNull();
        expect(userFacingError(new Error('INTERNAL SERVER ERROR'))).toBeNull();
    });

    it('suppresses a non-Error throw and an empty message', () => {
        expect(userFacingError('a string')).toBeNull();
        expect(userFacingError(new Error(''))).toBeNull();
        expect(userFacingError(undefined)).toBeNull();
    });
});
