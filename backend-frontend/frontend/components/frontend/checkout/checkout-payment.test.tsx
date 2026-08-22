import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';
import { CheckoutPayment } from './checkout-payment';

/**
 * Pastel #84, as amended 2026-08-18 · every payment method stays VISIBLE.
 *
 * Card arrived expanded and its form pushed iDEAL and PayPal below the fold.
 * The client watched a test booker with no card find iDEAL only much later -
 * a conversion loss that never looked like a bug, because the page was doing
 * exactly what it was written to do. #84's fix was to pre-select nothing.
 *
 * The founder has since restored the pre-selection, with the form moved OUT of
 * the Card row to below the whole list. That keeps #84's actual requirement -
 * no method is ever pushed out of sight - while the common case arrives ready
 * to type. So these tests now hold: all rows render together, Card is the
 * default WHEN IT IS PAYABLE (and nothing is chosen when it is not), picking
 * one selects only it, and pressing Pay with no choice says so instead of
 * swallowing the click. The e2e spec covers the same ground against a real
 * Stripe account, but it skips wherever no PSP key is configured - which is
 * most runs - so the regression guard has to live here too.
 */

const stripeApi = vi.hoisted(() => ({
    confirmCardPayment: vi.fn(),
    confirmPayPalPayment: vi.fn(),
    confirmIdealPayment: vi.fn(),
    confirmKlarnaPayment: vi.fn(),
    confirmPayment: vi.fn(),
}));

// The Express Checkout Element's props, captured so tests can drive its
// onReady/onClick/onConfirm events - the wallet sheet itself is device UI
// with no jsdom equivalent.
const eceProps = vi.hoisted(
    () => ({ current: null }) as { current: Record<string, any> | null }
);

const leaveToMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/checkout/leave-to', () => ({ leaveTo: leaveToMock }));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: () => Promise.resolve(null),
}));

// The Elements are cross-origin iframes with no jsdom equivalent. Their
// IDENTITY is what matters here: a test-id per Element is enough to prove the
// panel mounted (or did not), which is the whole question this file asks.
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
    useStripe: () => stripeApi,
    useElements: () => ({ getElement: () => ({}) }),
    CardNumberElement: () => <div data-testid='stripe-card-number' />,
    CardExpiryElement: () => <div data-testid='stripe-card-expiry' />,
    CardCvcElement: () => <div data-testid='stripe-card-cvc' />,
    ExpressCheckoutElement: (props: Record<string, any>) => {
        eceProps.current = props;
        return <div data-testid='stripe-ece' />;
    },
}));

const dict = en.checkout;

function renderPanel(
    over: Partial<Parameters<typeof CheckoutPayment>[0]> = {}
) {
    return render(
        <CheckoutPayment
            dict={dict}
            locale='en'
            publishableKey='pk_test_panel'
            clientSecret='pi_test_secret'
            contact={{
                fullName: 'E2E Traveller',
                email: 'traveller@example.test',
                country: 'NL',
            }}
            payToday={39}
            currency={over.currency ?? 'EUR'}
            eligibleMethods={
                over.eligibleMethods ?? ['card', 'ideal', 'paypal']
            }
            freeCancelLabel='Free cancellation up to 48h'
            processingHref='/curacao/payment/processing?ref=IT-2026-ABC'
            {...over}
        />
    );
}

const methodRow = (name: string) => screen.getByRole('button', { name });
const payButton = () =>
    screen.getByRole('button', { name: new RegExp(dict.reserve, 'i') });

describe('CheckoutPayment - method selection', () => {
    it('renders every method together, with Card the default', () => {
        renderPanel();

        // The point of #84: no method is hidden behind another's expansion.
        for (const name of [dict.card, 'iDEAL', dict.paypal]) {
            expect(methodRow(name)).toBeInTheDocument();
        }
        expect(methodRow(dict.card)).toHaveAttribute('aria-pressed', 'true');
        for (const name of ['iDEAL', dict.paypal]) {
            expect(methodRow(name)).toHaveAttribute('aria-pressed', 'false');
        }
    });

    it('has the card fields ready when Card is the default', () => {
        renderPanel();

        expect(screen.getByTestId('stripe-card-number')).toBeInTheDocument();
        expect(screen.getByTestId('stripe-card-expiry')).toBeInTheDocument();
        expect(screen.getByTestId('stripe-card-cvc')).toBeInTheDocument();
        expect(screen.getByLabelText(/name on card/i)).toBeInTheDocument();
    });

    it('mounts NO card fields when Card is not payable', () => {
        // The load-bearing assertion now. Card is the default only when it is
        // eligible; with it switched off, nothing is chosen and no Stripe
        // Element may be created - mounting one would both mislead the
        // traveller and start a card session on an account that cannot take it.
        renderPanel({ eligibleMethods: ['ideal', 'paypal'] });

        expect(screen.queryByTestId('stripe-card-number')).toBeNull();
        expect(screen.queryByLabelText(/name on card/i)).toBeNull();
        for (const name of [dict.card, 'iDEAL', dict.paypal]) {
            expect(methodRow(name)).toHaveAttribute('aria-pressed', 'false');
        }
    });

    it('selects one method at a time', () => {
        renderPanel();

        // Card is already the default, so this is a real switch away from it.
        fireEvent.click(methodRow(dict.paypal));

        expect(methodRow(dict.paypal)).toHaveAttribute('aria-pressed', 'true');
        expect(methodRow(dict.card)).toHaveAttribute('aria-pressed', 'false');
    });

    it('keeps the card fields alive across a look at PayPal', () => {
        renderPanel();

        fireEvent.click(methodRow(dict.card));
        const name = screen.getByLabelText(/name on card/i);
        fireEvent.change(name, { target: { value: 'E2E Traveller' } });

        fireEvent.click(methodRow(dict.paypal));
        fireEvent.click(methodRow(dict.card));

        // Unmounting the panel would DESTROY the Stripe Elements and wipe a
        // half-typed card, so the row collapses instead - the same contract
        // the contact step's Edit round trip honours.
        expect(screen.getByLabelText(/name on card/i)).toHaveValue(
            'E2E Traveller'
        );
    });
});

/**
 * Pastel #83 · iDEAL said "Not available for EUR" on an EUR checkout.
 *
 * iDEAL settles exclusively in euro, so the one currency that CAN pay by iDEAL
 * was named as the reason it could not. The cause: every method the intent
 * didn't offer got the same currency-blaming hint, even when the real reason
 * was the Stripe account's method configuration. The currency is now blamed
 * only when the currency rule IS the reason, and iDEAL is additionally
 * hard-gated to EUR whatever the intent claims.
 */
describe('CheckoutPayment - method availability by currency (Pastel 83)', () => {
    const notAvailableFor = (c: 'EUR' | 'USD') =>
        dict.methodUnavailable.replace('{currency}', c);

    it('EUR checkout: iDEAL is selectable when the intent offers it', () => {
        renderPanel({ currency: 'EUR' });

        expect(methodRow('iDEAL')).toBeEnabled();
        fireEvent.click(methodRow('iDEAL'));
        expect(methodRow('iDEAL')).toHaveAttribute('aria-pressed', 'true');
    });

    it('USD checkout: iDEAL is disabled and the currency is the stated reason', () => {
        renderPanel({ currency: 'USD', eligibleMethods: ['card', 'paypal'] });

        expect(methodRow('iDEAL')).toBeDisabled();
        expect(screen.getByText(notAvailableFor('USD'))).toBeInTheDocument();
    });

    it('EUR checkout with iDEAL not offered: never blames the euro', () => {
        // The reported bug verbatim: intent offers card only, checkout is EUR.
        renderPanel({ currency: 'EUR', eligibleMethods: ['card'] });

        expect(methodRow('iDEAL')).toBeDisabled();
        expect(methodRow(dict.paypal)).toBeDisabled();
        expect(methodRow('Klarna')).toBeDisabled();
        expect(screen.queryByText(notAvailableFor('EUR'))).toBeNull();
        expect(
            screen.getAllByText(dict.methodTemporarilyUnavailable).length
        ).toBe(3);
    });

    it('USD checkout: iDEAL stays disabled even if the intent claims to offer it', () => {
        renderPanel({
            currency: 'USD',
            eligibleMethods: ['card', 'ideal', 'paypal'],
        });

        expect(methodRow('iDEAL')).toBeDisabled();
        expect(screen.getByText(notAvailableFor('USD'))).toBeInTheDocument();
    });

    it('empty method list falls back to card-only with the honest hint', () => {
        renderPanel({ currency: 'EUR', eligibleMethods: [] });

        expect(methodRow(dict.card)).toBeEnabled();
        expect(methodRow('iDEAL')).toBeDisabled();
        expect(screen.queryByText(notAvailableFor('EUR'))).toBeNull();
    });
});

/**
 * Klarna - the fourth method tile. Rendered like iDEAL/PayPal (redirect, no
 * fields of ours) and offered ONLY when the intent reports it: Stripe filters
 * by account activation + market, the backend intersects with the admin's
 * per-method switch, and this row simply obeys `eligibleMethods`.
 */
describe('CheckoutPayment - Klarna', () => {
    it('is selectable when the intent offers it and confirms with the contact billing facts', () => {
        renderPanel({
            eligibleMethods: ['card', 'ideal', 'paypal', 'klarna'],
        });

        fireEvent.click(methodRow('Klarna'));
        expect(methodRow('Klarna')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(payButton());

        // Klarna requires email + billing country up front - both come from
        // the contact step, nothing new is asked of the traveller.
        expect(stripeApi.confirmKlarnaPayment).toHaveBeenCalledWith(
            'pi_test_secret',
            expect.objectContaining({
                payment_method: {
                    billing_details: {
                        email: 'traveller@example.test',
                        address: { country: 'NL' },
                    },
                },
                return_url: expect.stringContaining(
                    '/curacao/payment/processing?ref=IT-2026-ABC'
                ),
            })
        );
    });

    it('renders disabled with the honest hint while the account/admin does not offer it', () => {
        renderPanel(); // default eligibleMethods has no klarna

        expect(methodRow('Klarna')).toBeDisabled();
        fireEvent.click(methodRow('Klarna'));
        expect(methodRow('Klarna')).toHaveAttribute('aria-pressed', 'false');
        expect(stripeApi.confirmKlarnaPayment).not.toHaveBeenCalled();
    });
});

/**
 * Wallets (Apple Pay / Google Pay) - the Express Checkout Element block.
 * Wallets are device sheets, not radio rows: the Element renders only what
 * this browser can pay with, the admin's switches veto per wallet, and the
 * operator-conditions gate must stop the SHEET from opening, exactly as it
 * stops the Pay button.
 */
describe('CheckoutPayment - wallet express checkout', () => {
    it('mounts only when the admin offers a wallet, with the switches mapped per wallet', () => {
        eceProps.current = null;
        renderPanel();
        expect(screen.queryByTestId('stripe-ece')).toBeNull();

        renderPanel({ walletMethods: ['googlepay'] });
        expect(screen.getByTestId('stripe-ece')).toBeInTheDocument();
        expect(eceProps.current!.options.paymentMethods).toMatchObject({
            googlePay: 'auto',
            applePay: 'never',
            link: 'never',
            paypal: 'never',
            klarna: 'never',
        });

        renderPanel({ walletMethods: ['applepay'] });
        expect(eceProps.current!.options.paymentMethods).toMatchObject({
            applePay: 'auto',
            googlePay: 'never',
        });
    });

    it('stays hidden until the Element reports a wallet this browser can pay with', () => {
        renderPanel({ walletMethods: ['applepay', 'googlepay'] });
        const wrapper = screen.getByTestId('stripe-ece').parentElement!;

        // No dead buttons, no layout hole: hidden until onReady says a
        // wallet is genuinely available on this device.
        expect(wrapper.className).toContain('hidden');

        act(() =>
            eceProps.current!.onReady({
                availablePaymentMethods: { applePay: true, googlePay: false },
            })
        );
        expect(wrapper.className).not.toContain('hidden');
    });

    it('never opens the wallet sheet while the operator-conditions box is empty', () => {
        const onTermsUnsatisfied = vi.fn();
        renderPanel({
            walletMethods: ['applepay', 'googlepay'],
            termsSatisfied: false,
            onTermsUnsatisfied,
        });

        const resolve = vi.fn();
        eceProps.current!.onClick({ resolve });

        expect(onTermsUnsatisfied).toHaveBeenCalled();
        // Withholding resolve() IS the "do not open" signal to the Element.
        expect(resolve).not.toHaveBeenCalled();
    });

    it('opens the sheet when the gate is satisfied, and a confirmed wallet payment leaves to processing', async () => {
        renderPanel({ walletMethods: ['applepay'], termsSatisfied: true });

        const resolve = vi.fn();
        eceProps.current!.onClick({ resolve });
        expect(resolve).toHaveBeenCalled();

        stripeApi.confirmPayment.mockResolvedValue({
            paymentIntent: { status: 'succeeded' },
        });
        await eceProps.current!.onConfirm();

        expect(stripeApi.confirmPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                redirect: 'if_required',
                confirmParams: {
                    return_url: expect.stringContaining(
                        '/curacao/payment/processing?ref=IT-2026-ABC'
                    ),
                },
            })
        );
        expect(leaveToMock).toHaveBeenCalledWith(
            '/curacao/payment/processing?ref=IT-2026-ABC'
        );
    });

    it('surfaces a wallet decline as the form-level error instead of navigating', async () => {
        leaveToMock.mockClear();
        renderPanel({ walletMethods: ['googlepay'] });

        stripeApi.confirmPayment.mockResolvedValue({
            error: { message: 'Your card was declined.' },
        });
        await eceProps.current!.onConfirm();

        expect(
            await screen.findByText('Your card was declined.')
        ).toBeInTheDocument();
        expect(leaveToMock).not.toHaveBeenCalled();
    });
});

/**
 * Pastel #80 · the operator-conditions gate. `termsSatisfied === false` must
 * stop the Pay handler BEFORE any method work - the server 422s the charge
 * without acceptance anyway, but this one-line client guard is exactly what a
 * later handlePay refactor could silently drop.
 */
describe('CheckoutPayment - operator-conditions gate (Pastel 80)', () => {
    it('refuses to pay while the gate is unsatisfied, even with a method picked', () => {
        const onTermsUnsatisfied = vi.fn();
        renderPanel({ termsSatisfied: false, onTermsUnsatisfied });

        fireEvent.click(methodRow('iDEAL'));
        fireEvent.click(payButton());

        expect(onTermsUnsatisfied).toHaveBeenCalled();
        expect(stripeApi.confirmIdealPayment).not.toHaveBeenCalled();
        expect(stripeApi.confirmCardPayment).not.toHaveBeenCalled();
    });

    it('a satisfied gate falls through to the normal validation', () => {
        const onTermsUnsatisfied = vi.fn();
        // Card off, so the gate's next stop really is "choose a method" - with
        // Card payable it is the default and the click goes straight through.
        renderPanel({
            termsSatisfied: true,
            onTermsUnsatisfied,
            eligibleMethods: ['ideal', 'paypal'],
        });

        fireEvent.click(payButton());

        // Past the gate: the next stop is "choose a method".
        expect(onTermsUnsatisfied).not.toHaveBeenCalled();
        expect(screen.getByText(dict.selectMethodError)).toBeInTheDocument();
    });
});

describe('CheckoutPayment - the default method is the one that pays', () => {
    /**
     * The regression that made this test exist: `activeMethod` (Card by
     * default) drove the radio, the row tint and the card panel, while the Pay
     * guard read the raw `method` state - which stays null until the traveller
     * touches a row. So the page showed Card selected and then refused to pay,
     * asking them to "select a payment method" they could see was already
     * selected. Two names for one thing, and only one of them was checked.
     */
    it('reaches CARD validation, not "choose a method", on a first click', () => {
        renderPanel();

        expect(methodRow(dict.card)).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(payButton());

        // The guard must not fire...
        expect(screen.queryByText(dict.selectMethodError)).toBeNull();
        // ...and the click must land in the CARD branch, which is proved by
        // its own required-field check answering instead. (It stops there
        // rather than charging because "Name on card" is empty - that part is
        // correct and is what a real first click does.)
        expect(screen.getByText(dict.requiredError)).toBeInTheDocument();
    });
});

describe('CheckoutPayment - paying without a choice', () => {
    // Reachable only with Card ineligible: Card is otherwise pre-selected, and
    // the Pay button then has a method to work with. These render without it.
    it('prompts for a method instead of swallowing the click', () => {
        renderPanel({ eligibleMethods: ['ideal', 'paypal'] });

        fireEvent.click(payButton());

        expect(screen.getByText(dict.selectMethodError)).toBeInTheDocument();
        expect(stripeApi.confirmCardPayment).not.toHaveBeenCalled();
        expect(stripeApi.confirmPayPalPayment).not.toHaveBeenCalled();
        expect(stripeApi.confirmIdealPayment).not.toHaveBeenCalled();
    });

    it('drops the prompt as soon as a method is picked', async () => {
        renderPanel({ eligibleMethods: ['ideal', 'paypal'] });

        fireEvent.click(payButton());
        expect(screen.getByText(dict.selectMethodError)).toBeInTheDocument();

        fireEvent.click(methodRow('iDEAL'));

        // The message is answered by the click that answers it - leaving it up
        // would accuse iDEAL of a failure that was never its own. Awaited
        // because `FormError` fades out: the node lingers, already invisible,
        // until `AnimatePresence` finishes the exit and unmounts it.
        await waitFor(() =>
            expect(screen.queryByText(dict.selectMethodError)).toBeNull()
        );
    });
});
