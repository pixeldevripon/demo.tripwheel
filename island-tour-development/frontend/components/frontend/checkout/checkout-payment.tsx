'use client';

import { formatCheckoutMoney } from '@/lib/checkout/checkout';
import { leaveTo } from '@/lib/checkout/leave-to';
import type { Currency, Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    CardCvcElement,
    CardExpiryElement,
    CardNumberElement,
    Elements,
    ExpressCheckoutElement,
    useElements,
    useStripe,
} from '@stripe/react-stripe-js';
import {
    loadStripe,
    type StripeCardNumberElementOptions,
    type StripeElementsOptions,
} from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { memo, useId, useMemo, useState, type ReactNode } from 'react';
import {
    Collapse,
    ConsentLine,
    Field,
    FieldShell,
    FormError,
    FreeCancelNote,
    PayCtaButton,
    Radio,
    SecureCheckoutRow,
} from './checkout-fields';

type CheckoutDict = Dictionary['checkout'];

type PayMethod = 'card' | 'ideal' | 'paypal' | 'klarna';

/** Passive brand mark on a method row (real network SVGs, never text). */
function BrandMark({
    src,
    className = 'h-6 w-auto',
}: {
    src: string;
    className?: string;
}) {
    return (
        <Image
            src={src}
            alt=''
            width={74}
            height={41}
            className={`${className} shrink-0`}
        />
    );
}

/** Contact fields the payment step needs for the Stripe billing details. */
export interface PaymentContact {
    fullName: string;
    email: string;
    country: string;
}

interface CheckoutPaymentProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Stripe publishable key from the PaymentIntent response. */
    publishableKey: string;
    /** PaymentIntent client secret to confirm. */
    clientSecret: string;
    contact: PaymentContact;
    /** Amount charged today (booking currency), for the CTA label. */
    payToday: number;
    currency: Currency;
    /** Eligible methods for this booking (account-activated + currency-compatible). */
    eligibleMethods: string[];
    /**
     * Wallet buttons this checkout MAY render (admin-switch gated, Stripe leg
     * only). The Express Checkout Element itself decides what actually shows:
     * account activation, Apple Pay domain registration and the device's own
     * wallet capability all veto silently - so the block renders nothing on a
     * browser that cannot pay, rather than a dead button.
     */
    walletMethods?: string[];
    /** Composed free-cancellation reassurance line under the pay CTA. */
    freeCancelLabel: string;
    /** Relative TYP-processing path (with ?ref); redirect return_url is built from it. */
    processingHref: string;
    /**
     * Operator-conditions gate (Pastel #80 / MCK-20): rendered between the
     * method list and the CTA, directly above the consent line. The checkout
     * form owns the node and its state; this component only places it and
     * refuses to pay while `termsSatisfied` is false.
     */
    termsGate?: ReactNode;
    termsSatisfied?: boolean;
    /** Called by a Pay tap with the box empty - the gate shows its error line. */
    onTermsUnsatisfied?: () => void;
}

/**
 * Payment section content (Figma 47667:15365) wired to Stripe - rendered inside
 * the checkout accordion card (the section header/badge and the expand/collapse
 * shell live in `checkout-form`). Card is collected INLINE via
 * styled Stripe Card Elements (transparent iframes, no Stripe-hosted UI) and
 * confirmed with confirmCardPayment. PayPal + iDEAL + Klarna confirm
 * client-side and REDIRECT to the provider (return_url -> /payment/processing)
 * - those methods have no fields to collect by design. Methods not in
 * `eligibleMethods` (account-inactive, admin-switched-off, or currency
 * ineligible - e.g. iDEAL is EUR-only) render disabled with a hint.
 *
 * NOTHING is pre-selected: every row renders collapsed so the traveller
 * sees every method they can pay with before choosing one (Pastel 84). Picking
 * one is therefore a real validation step - see `handleReserve`.
 */
export const CheckoutPayment = memo(function CheckoutPayment(
    props: CheckoutPaymentProps
) {
    const stripePromise = useMemo(
        () => loadStripe(props.publishableKey),
        [props.publishableKey]
    );
    const options: StripeElementsOptions = useMemo(
        () => ({ locale: props.locale }),
        [props.locale]
    );
    return (
        <Elements stripe={stripePromise} options={options}>
            <PaymentInner {...props} stripePromise={stripePromise} />
        </Elements>
    );
});

function PaymentInner({
    dict,
    locale,
    clientSecret,
    contact,
    payToday,
    currency,
    eligibleMethods,
    walletMethods = [],
    freeCancelLabel,
    processingHref,
    termsGate,
    termsSatisfied,
    onTermsUnsatisfied,
    stripePromise,
}: CheckoutPaymentProps & {
    stripePromise: ReturnType<typeof loadStripe>;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const methodsLabelId = useId();

    /**
     * Hard scheme fact, independent of what the Stripe account has enabled:
     * iDEAL settles exclusively in euro. Card and PayPal take both platform
     * currencies. This is a belt on eligibility AND what picks a truthful
     * disabled-row hint (Pastel 83).
     */
    const currencyAllows = (m: PayMethod) =>
        m !== 'ideal' || currency === 'EUR';

    // Card is always offered when eligible; if the intent didn't report methods
    // (older/edge response) fall back to card-only. DELIBERATE safety net:
    // an empty list can now also mean "every admin-enabled method is inactive
    // at the PSP" (only reachable by raw-API config writes - the dashboard
    // refuses to switch the last ACTIVE method off), and stranding the
    // traveller with zero ways to pay is worse than offering Card, which the
    // PSP will still honestly decline if it truly cannot charge.
    const isEligible = (m: PayMethod) =>
        currencyAllows(m) &&
        (eligibleMethods.length === 0
            ? m === 'card'
            : eligibleMethods.includes(m));

    /**
     * No method is chosen until the traveller chooses one (Pastel 84).
     *
     * Card used to be pre-selected, and its expanded form pushed iDEAL and
     * PayPal below the fold - a client watched a test booker with no card find
     * iDEAL only much later. All three rows now start collapsed, so the choice
     * is visible before it is made, and `null` is a state the pay path has to
     * answer for rather than one it can assume away.
     */
    const [method, setMethod] = useState<PayMethod | null>(null);

    /**
     * The card panel is rendered from the first time Card is picked, and stays
     * rendered afterwards - `MethodRow` collapses it rather than unmounting it.
     *
     * It is not rendered up front because the Stripe Elements would mount into
     * a zero-height collapsed box, and because a traveller paying by iDEAL has
     * no use for them at all (the deferred mount the issue itself allows for).
     *
     * It is not unmounted on switching away because unmounting DESTROYS the
     * Elements: a half-typed card number would not survive a look at PayPal,
     * and the remount would land inside a box that is animating open. The
     * contact step's Edit round trip keeps its fields alive for the same
     * reason.
     */
    const [cardPanelMounted, setCardPanelMounted] = useState(false);

    /**
     * The name is the ONLY card field we own - number, expiry and CVC are
     * Stripe Elements, and we deliberately ask for no postal code (master 3,
     * "billing data from Stripe, no extra booking-form friction").
     */
    const [cardName, setCardName] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    /**
     * Write the name and drop any error sitting on it.
     *
     * The errors map is only ever rebuilt by `handleReserve`, so without this a
     * "This field is required" message survived the traveller filling the field
     * in - a filled box kept its red border and the required error under it
     * until they pressed Pay again (test report 2026-08-01, first seen on the
     * card postal code we no longer collect).
     *
     * Clears rather than re-validates, matching the rest of the site: checking
     * on every keystroke flashes the error back while a value is half-typed.
     * The submit path is still the authority on whether the field is valid.
     */
    const setCardNameField = (value: string) => {
        setCardName(value);
        setErrors(p => {
            if (!p.name) return p;
            const { name: _cleared, ...rest } = p;
            return rest;
        });
    };
    const [formError, setFormError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    /**
     * Choose a method, and drop the form-level message the last one left.
     *
     * It always belongs to the method that raised it - "choose a method" is
     * answered by this very click, and a decline describes a charge on the
     * method being navigated away from. Field errors are deliberately NOT
     * cleared: the card inputs survive the switch, so their errors are still
     * true when the traveller comes back to them.
     */
    const selectMethod = (next: PayMethod) => {
        setMethod(next);
        setFormError(null);
        if (next === 'card') setCardPanelMounted(true);
    };

    const elementStyle: StripeCardNumberElementOptions = useMemo(
        () => ({
            style: {
                base: {
                    color: '#2c2c2c',
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
                    fontSize: '16px',
                    letterSpacing: '-0.012em',
                    '::placeholder': { color: 'rgba(44,44,44,0.3)' },
                },
                invalid: { color: '#2c2c2c' },
            },
        }),
        []
    );

    const money = (n: number) => formatCheckoutMoney(n, currency, locale);
    const unavailable = dict.methodUnavailable.replace('{currency}', currency);
    /**
     * Blame the currency ONLY when the currency rule is the reason (Pastel 83:
     * an EUR checkout read "iDEAL - Not available for EUR", inverting a scheme
     * fact, because ANY method the intent didn't offer got the currency
     * blamed). A method the currency allows but the account doesn't offer
     * reads the honest copy instead.
     */
    const hintFor = (m: PayMethod) =>
        currencyAllows(m) ? dict.methodTemporarilyUnavailable : unavailable;

    async function handleReserve() {
        if (processing || !stripe) return;
        setFormError(null);

        // Operator-conditions gate (Pastel #80): the required box sits above
        // this CTA and must be ticked before anything charges. The gate
        // component owns the calm error line; this only asks for it. Checked
        // FIRST - the mockup's demo is exactly "tap Reserve with the box
        // empty", and the backend refuses the charge without acceptance
        // anyway, so no method work should start.
        if (termsSatisfied === false) {
            onTermsUnsatisfied?.();
            return;
        }

        // Nothing is pre-selected any more, so "which method?" is a question
        // the traveller can actually reach the Pay button without answering.
        // Say so instead of swallowing the click.
        if (!method) {
            setFormError(dict.selectMethodError);
            return;
        }

        // ── Card: confirm inline (no redirect); 3DS handled by an inline modal. ──
        if (method === 'card') {
            if (!elements) return;
            const next: Record<string, string> = {};
            if (!cardName.trim()) next.name = dict.requiredError;
            setErrors(next);
            if (Object.keys(next).length > 0) return;

            const cardNumber = elements.getElement(CardNumberElement);
            if (!cardNumber) return;

            setProcessing(true);
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardNumber,
                    billing_details: {
                        name: cardName || contact.fullName,
                        email: contact.email,
                        // No postal code: we never ask for one. The billing
                        // snapshot (country / postal / city) is read back off
                        // the Stripe payment method at webhook time, so the
                        // only address part we pass is the country the contact
                        // step already had.
                        ...(contact.country
                            ? { address: { country: contact.country } }
                            : {}),
                    },
                },
            });
            if (result.error) {
                setProcessing(false);
                setFormError(result.error.message ?? dict.paymentError);
                return;
            }
            const status = result.paymentIntent?.status;
            if (status === 'succeeded' || status === 'processing') {
                // Document navigation - the processing route is never
                // prerendered, so the client router would fetch HTML, fail to
                // parse it and hard-navigate anyway (lib/checkout/leave-to.ts).
                leaveTo(processingHref);
                return;
            }
            setProcessing(false);
            setFormError(dict.paymentError);
            return;
        }

        // ── PayPal / iDEAL / Klarna: confirm + REDIRECT to the provider, then
        // return_url. return_url must be absolute; on success the browser
        // navigates away, so we only handle the error case here.
        const returnUrl = `${window.location.origin}${processingHref}`;
        setProcessing(true);
        const result =
            method === 'paypal'
                ? await stripe.confirmPayPalPayment(clientSecret, {
                      return_url: returnUrl,
                  })
                : method === 'klarna'
                  ? await stripe.confirmKlarnaPayment(clientSecret, {
                        payment_method: {
                            // Klarna requires an email and a billing country
                            // up front (it decides the offered plans by
                            // market) - both already collected at the contact
                            // step, so nothing new is asked of the traveller.
                            billing_details: {
                                email: contact.email,
                                address: { country: contact.country },
                            },
                        },
                        return_url: returnUrl,
                    })
                  : await stripe.confirmIdealPayment(clientSecret, {
                        payment_method: {
                            // No iDEAL Bank Element: omit the bank so Stripe collects it
                            // on the redirect (modern iDEAL has no pre-selection).
                            ideal: {},
                            billing_details: {
                                name: contact.fullName || undefined,
                                email: contact.email,
                            },
                        },
                        return_url: returnUrl,
                    });
        if (result?.error) {
            setProcessing(false);
            setFormError(result.error.message ?? dict.paymentError);
        }
    }

    return (
        <div className='flex flex-col'>
            {/* .pm-label + the two trust cues of the payment moment (5.8):
                the secure-checkout row with the slate Stripe badge here, and
                the free-cancellation line at the commit button below. */}
            <span
                id={methodsLabelId}
                className='mt-0.5 mb-2.5 text-[12.5px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                {dict.selectPaymentMethod}
            </span>
            <SecureCheckoutRow psp='Stripe' dict={dict} />

            {/* Wallet buttons (Apple Pay / Google Pay) in their OWN Elements
                group: the Express Checkout Element needs a clientSecret-mode
                group, while the split Card Elements below run secretless and
                confirm imperatively - the two modes cannot share one group.
                Renders nothing on a device that cannot pay. */}
            {walletMethods.length > 0 && (
                <Elements
                    stripe={stripePromise}
                    options={{ clientSecret, locale }}>
                    <WalletExpressRow
                        walletMethods={walletMethods}
                        processingHref={processingHref}
                        termsSatisfied={termsSatisfied}
                        onTermsUnsatisfied={onTermsUnsatisfied}
                        onError={setFormError}
                        paymentError={dict.paymentError}
                    />
                </Elements>
            )}

            {/* Payment methods - ONE bordered radio list (design v2 .pm):
                hairline-divided rows, tinted selected row, methods expand in
                place under their row. All start collapsed (Pastel 84). */}
            <div
                role='group'
                aria-labelledby={methodsLabelId}
                className='overflow-hidden rounded-it-md border-[1.5px] border-it-border bg-it-white'>
                {/* Card */}
                <MethodRow
                    selected={method === 'card'}
                    eligible={isEligible('card')}
                    hint={hintFor('card')}
                    onSelect={() => selectMethod('card')}
                    label={dict.card}
                    // The only row holding Stripe Elements: they are created on
                    // the render that opens it, and kept from then on.
                    mounted={cardPanelMounted}
                    instant
                    logos={
                        <>
                            <BrandMark src='/icons/payments/pay-1.svg' />
                            <BrandMark src='/icons/payments/pay-2.svg' />
                            <BrandMark src='/icons/payments/pay-8.svg' />
                        </>
                    }>
                    {/* Card fields (Stripe Card Elements, styled to the mockup;
                        brand auto-detected from the number). Mounted from the
                        first time Card is picked - see `cardPanelMounted`. */}
                    <div className='flex flex-col gap-3.5 px-4 pb-[18px] pt-1.5'>
                        <FieldShell
                            label={dict.cardNumber}
                            error={errors.number}>
                            <CardNumberElement
                                options={{
                                    ...elementStyle,
                                    placeholder: dict.cardNumberPlaceholder,
                                    showIcon: true,
                                }}
                                onChange={e =>
                                    setErrors(p => ({
                                        ...p,
                                        number: e.error ? e.error.message : '',
                                    }))
                                }
                                className='w-full'
                            />
                        </FieldShell>
                        <div className='flex flex-col gap-3.5 sm:flex-row'>
                            <FieldShell
                                className='flex-1'
                                label={dict.expiry}
                                error={errors.expiry}>
                                <CardExpiryElement
                                    options={{
                                        ...elementStyle,
                                        placeholder: dict.expiryPlaceholder,
                                    }}
                                    onChange={e =>
                                        setErrors(p => ({
                                            ...p,
                                            expiry: e.error
                                                ? e.error.message
                                                : '',
                                        }))
                                    }
                                    className='w-full'
                                />
                            </FieldShell>
                            <FieldShell
                                className='flex-1'
                                label={dict.cvv}
                                error={errors.cvv}>
                                <CardCvcElement
                                    options={{
                                        ...elementStyle,
                                        placeholder: dict.cvvPlaceholder,
                                    }}
                                    onChange={e =>
                                        setErrors(p => ({
                                            ...p,
                                            cvv: e.error ? e.error.message : '',
                                        }))
                                    }
                                    className='w-full'
                                />
                            </FieldShell>
                        </div>
                        {/* Name on card is the last field we own - there is no
                            postal code input by design (Pastel 82). It carries
                            the asterisk the postal code used to: the name has
                            always been rejected empty by `handleReserve`, and
                            the contact step marks every required field, so
                            without it this panel now enforces a rule it does
                            not state. */}
                        <Field
                            label={dict.nameOnCard}
                            required
                            value={cardName}
                            onChange={setCardNameField}
                            error={errors.name}
                        />
                    </div>
                </MethodRow>

                {/* iDEAL (EUR-only by scheme rule; the currency is only ever
                    blamed when it IS the reason - Pastel 83). */}
                <MethodRow
                    selected={method === 'ideal'}
                    eligible={isEligible('ideal')}
                    hint={hintFor('ideal')}
                    onSelect={() => selectMethod('ideal')}
                    label='iDEAL'
                    logos={
                        <BrandMark
                            src='/icons/payments/pay-4.svg'
                            className='h-6 w-auto'
                        />
                    }>
                    <p className='px-4 pb-[18px] pt-0.5 text-[11.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {dict.redirectNote}
                    </p>
                </MethodRow>

                {/* PayPal (redirect). */}
                <MethodRow
                    selected={method === 'paypal'}
                    eligible={isEligible('paypal')}
                    hint={hintFor('paypal')}
                    onSelect={() => selectMethod('paypal')}
                    label={dict.paypal}
                    logos={
                        <BrandMark
                            src='/icons/payments/pay-3.svg'
                            className='h-6 w-auto'
                        />
                    }>
                    <p className='px-4 pb-[18px] pt-0.5 text-[11.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {dict.redirectNote}
                    </p>
                </MethodRow>

                {/* Klarna (redirect; brand name, untranslated like iDEAL).
                    Offered only when the intent reports it - Stripe already
                    filters by account activation + market/currency, and the
                    backend intersects with the admin's per-method switch. */}
                <MethodRow
                    selected={method === 'klarna'}
                    eligible={isEligible('klarna')}
                    hint={hintFor('klarna')}
                    onSelect={() => selectMethod('klarna')}
                    label='Klarna'
                    logos={
                        <BrandMark
                            src='/icons/payments/pay-7.svg'
                            className='h-6 w-auto'
                        />
                    }>
                    <p className='px-4 pb-[18px] pt-0.5 text-[11.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {dict.redirectNote}
                    </p>
                </MethodRow>
            </div>

            {/* Operator-conditions gate (Pastel #80): between the methods and
                the CTA, directly above the locked consent line. */}
            {termsGate}

            {/* Form-level error (charge failure / unavailable). */}
            <FormError error={formError} />

            {/* Commit CTA: lock + exact amount ("Reserve my spot · Pay $71"). */}
            <PayCtaButton
                onClick={handleReserve}
                disabled={processing || !stripe}
                processing={processing}
                dict={dict}
                amountLabel={payToday > 0 ? money(payToday) : null}
            />

            {/* Free-cancellation + implied consent at the commit moment (5.8). */}
            <FreeCancelNote label={freeCancelLabel} />
            <ConsentLine
                consent={dict.consent}
                consentTerms={dict.consentTerms}
                consentPrivacy={dict.consentPrivacy}
                securePayment={dict.securePayment}
                locale={locale}
            />
        </div>
    );
}

/**
 * The device-wallet buttons (Apple Pay / Google Pay) above the method list.
 *
 * Wallets are not radio rows: the DEVICE draws the payment sheet (Safari's
 * Apple Pay sheet, Chrome's Google Pay sheet), so the integration is Stripe's
 * Express Checkout Element - it renders only the wallet buttons this browser
 * can actually pay with, and nothing at all otherwise (`onReady` reports no
 * available methods and the wrapper stays hidden; no dead buttons, no layout
 * hole). `walletMethods` (the admin's switches) vetoes per wallet on top.
 *
 * The operator-conditions gate applies here exactly like the Pay button: the
 * sheet must not even OPEN while the box is unticked, so the click handler
 * withholds `resolve()` and raises the gate's error line instead.
 */
function WalletExpressRow({
    walletMethods,
    processingHref,
    termsSatisfied,
    onTermsUnsatisfied,
    onError,
    paymentError,
}: {
    walletMethods: string[];
    processingHref: string;
    termsSatisfied?: boolean;
    onTermsUnsatisfied?: () => void;
    onError: (message: string | null) => void;
    paymentError: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [visible, setVisible] = useState(false);

    return (
        <div className={visible ? 'mb-2.5' : 'hidden'}>
            <ExpressCheckoutElement
                options={{
                    // Only what the admin switched on; everything else the
                    // Element could render is vetoed - the method list below
                    // owns PayPal/Klarna as rows, and Link/Amazon Pay are not
                    // part of this checkout at all.
                    paymentMethods: {
                        applePay: walletMethods.includes('applepay')
                            ? 'auto'
                            : 'never',
                        googlePay: walletMethods.includes('googlepay')
                            ? 'auto'
                            : 'never',
                        link: 'never',
                        paypal: 'never',
                        amazonPay: 'never',
                        klarna: 'never',
                    },
                    buttonHeight: 48,
                }}
                onReady={event =>
                    setVisible(
                        Boolean(
                            event.availablePaymentMethods?.applePay ||
                                event.availablePaymentMethods?.googlePay
                        )
                    )
                }
                onClick={event => {
                    // Same first check as handleReserve: no sheet while the
                    // operator-conditions box is empty. Not resolving is how
                    // the Element is told "do not open".
                    if (termsSatisfied === false) {
                        onTermsUnsatisfied?.();
                        return;
                    }
                    onError(null);
                    event.resolve();
                }}
                onConfirm={async () => {
                    if (!stripe || !elements) return;
                    const { error, paymentIntent } = await stripe.confirmPayment(
                        {
                            elements,
                            confirmParams: {
                                // Absolute, like the redirect methods: most
                                // wallet confirms settle in place, but a bank
                                // may still force a 3DS hop.
                                return_url: `${window.location.origin}${processingHref}`,
                            },
                            redirect: 'if_required',
                        }
                    );
                    if (error) {
                        onError(error.message ?? paymentError);
                        return;
                    }
                    const status = paymentIntent?.status;
                    if (status === 'succeeded' || status === 'processing') {
                        // Document navigation, same as the card path - the
                        // processing route is never prerendered
                        // (lib/checkout/leave-to.ts).
                        leaveTo(processingHref);
                        return;
                    }
                    onError(paymentError);
                }}
            />
        </div>
    );
}

/**
 * A selectable payment-method row in the unified list (design v2 .pm-opt):
 * radio + name + passive network chips; the selected row gets the orange tint
 * and its children (card fields / redirect note) expand underneath. When
 * ineligible it renders dimmed and non-interactive with a hint (master:
 * hide/disable methods that can't take this booking's payment).
 */
function MethodRow({
    selected,
    eligible,
    hint,
    onSelect,
    label,
    logos,
    mounted = true,
    instant = false,
    children,
}: {
    selected: boolean;
    eligible: boolean;
    hint: string;
    onSelect: () => void;
    label: string;
    /** Passive network chips at the row's right edge. */
    logos?: ReactNode;
    /**
     * Put the children in the DOM at all. Defaults to true, which is right for
     * a row whose content is one line of text. The Card row passes its
     * "opened at least once" latch instead, so the Stripe Elements are created
     * ONCE, and never at all for a traveller paying by iDEAL - see
     * `cardPanelMounted`.
     */
    mounted?: boolean;
    /**
     * Snap open at full height instead of growing into it (the fade still
     * carries the motion). Same rule as `Collapse`'s own `instant`: a PSP
     * iframe must not mount inside a zero-height, clipped, still-animating box,
     * because it settles its layout against a container that is still moving.
     * Set it on any row whose children mount Stripe Elements - and on no
     * others, so a row holding one line of text keeps its slide.
     */
    instant?: boolean;
    /** Content under the row - collapsed while unselected, never unmounted. */
    children?: ReactNode;
}) {
    const open = selected && eligible;
    return (
        <div className='border-t border-it-divider first:border-t-0'>
            <motion.button
                type='button'
                disabled={!eligible}
                onClick={onSelect}
                whileTap={eligible ? { scale: 0.995 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 border-none px-4 py-3.5 text-left transition-colors duration-300 ${
                    !eligible
                        ? 'cursor-not-allowed bg-it-white opacity-40'
                        : open
                          ? 'cursor-pointer bg-it-primary-subtle'
                          : 'cursor-pointer bg-it-white'
                }`}>
                <Radio selected={open} />
                <span className='text-[13px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                    {label}
                </span>
                {logos && (
                    <span className='ml-auto flex items-center gap-1.5'>
                        {logos}
                    </span>
                )}
            </motion.button>
            {!eligible && (
                <p className='px-4 pb-2.5 text-[11.5px] leading-[1.4] text-it-text-muted tracking-[-0.012em]'>
                    {hint}
                </p>
            )}
            {/* `Collapse`, not an unmount: collapsed children stay in the DOM
                and inert, so a card entered before a look at PayPal is still
                there on the way back. An `instant` row snaps OPEN and still
                animates CLOSED - opening is the direction that matters, since
                nothing mounts on the way out. Same contract the payment
                section itself uses in `checkout-form`. */}
            {children && mounted && (
                <Collapse open={open} instant={instant && open}>
                    {children}
                </Collapse>
            )}
        </div>
    );
}

