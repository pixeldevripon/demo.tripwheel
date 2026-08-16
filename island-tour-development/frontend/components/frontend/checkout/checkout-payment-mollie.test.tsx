import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';

/**
 * Pastel #80 · the operator-conditions gate on the MOLLIE leg. The Mollie
 * payment is only CREATED at Pay (`createAndGo` -> createPaymentIntent), so
 * the `termsSatisfied === false` guard in `handlePay` is the client-side line
 * between an unticked box and a real payment being minted. Same contract as
 * the Stripe leg's guard (checkout-payment.test.tsx).
 */

const createPaymentIntent = vi.fn();
vi.mock('@/lib/api/bookings', () => ({
    createPaymentIntent: (...a: unknown[]) => createPaymentIntent(...a),
}));

// profileId is null in these tests, so mollie.js is never loaded - the mock
// exists only so the import graph resolves without the real script loader.
vi.mock('@/lib/mollie/mollie-js', () => ({
    loadMollieJs: vi.fn(),
    toMollieJsLocale: (l: string) => l,
}));

vi.mock('@/lib/checkout/leave-to', () => ({ leaveTo: vi.fn() }));

const { CheckoutPaymentMollie } = await import('./checkout-payment-mollie');

const dict = en.checkout;

function renderPanel(
    over: Partial<Parameters<typeof CheckoutPaymentMollie>[0]> = {}
) {
    return render(
        <CheckoutPaymentMollie
            dict={dict}
            locale='en'
            bookingId='booking-1'
            profileId={null}
            testmode
            payToday={39}
            currency='EUR'
            freeCancelLabel='Free cancellation up to 48h'
            processingHref='/curacao/payment/processing?ref=IT-2026-ABC'
            {...over}
        />
    );
}

const payButton = () =>
    screen.getByRole('button', { name: new RegExp(dict.reserve, 'i') });

describe('CheckoutPaymentMollie - operator-conditions gate (Pastel 80)', () => {
    it('refuses to mint a payment while the gate is unsatisfied', () => {
        const onTermsUnsatisfied = vi.fn();
        renderPanel({ termsSatisfied: false, onTermsUnsatisfied });

        fireEvent.click(payButton());

        expect(onTermsUnsatisfied).toHaveBeenCalled();
        expect(createPaymentIntent).not.toHaveBeenCalled();
    });

    it('a satisfied gate proceeds to create the payment', () => {
        createPaymentIntent.mockResolvedValue({ checkoutUrl: null });
        const onTermsUnsatisfied = vi.fn();
        renderPanel({ termsSatisfied: true, onTermsUnsatisfied });

        fireEvent.click(payButton());

        expect(onTermsUnsatisfied).not.toHaveBeenCalled();
        expect(createPaymentIntent).toHaveBeenCalled();
    });
});
