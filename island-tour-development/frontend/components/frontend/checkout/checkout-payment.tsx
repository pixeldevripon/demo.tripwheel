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

type PayMethod = 'card' | 'ideal' | 'paypal';

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
    /** Composed free-cancellation reassurance line under the pay CTA. */
    freeCancelLabel: string;
    /** Relative TYP-processing path (with ?ref); redirect return_url is built from it. */
    processingHref: string;
}

/**
 * Payment section content (Figma 47667:15365) wired to Stripe - rendered inside
 * the checkout accordion card (the section header/badge and the expand/collapse
 * shell live in `checkout-form`). Card is collected INLINE via
 * styled Stripe Card Elements (transparent iframes, no Stripe-hosted UI) and
 * confirmed with confirmCardPayment. PayPal + iDEAL confirm client-side and
 * REDIRECT to the provider (return_url -> /payment/processing) - those methods have
 * no fields to collect by design. Methods not in `eligibleMethods` (account /
 * currency ineligible - e.g. iDEAL is EUR-only) render disabled with a hint.
 *
 * NOTHING is pre-selected: all three rows render collapsed so the traveller
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
            <PaymentInner {...props} />
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
    freeCancelLabel,
    processingHref,
}: CheckoutPaymentProps) {
    const stripe = useStripe();
    const elements = useElements();
    const methodsLabelId = useId();

    // Card is always offered when eligible; if the intent didn't report methods
    // (older/edge response) fall back to card-only.
    const isEligible = (m: PayMethod) =>
        eligibleMethods.length === 0
            ? m === 'card'
            : eligibleMethods.includes(m);

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

    async function handleReserve() {
        if (processing || !stripe) return;
        setFormError(null);

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

        // ── PayPal / iDEAL: confirm + REDIRECT to the provider, then return_url. ──
        // return_url must be absolute; on success the browser navigates away, so we
        // only handle the error case here.
        const returnUrl = `${window.location.origin}${processingHref}`;
        setProcessing(true);
        const result =
            method === 'paypal'
                ? await stripe.confirmPayPalPayment(clientSecret, {
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
                className='mt-0.5 mb-2.5 text-[13.5px] font-bold leading-[1.5] text-it-ink'>
                {dict.selectPaymentMethod}
            </span>
            <SecureCheckoutRow psp='Stripe' dict={dict} />

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
                    hint={unavailable}
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

                {/* iDEAL (EUR-only; auto-disabled for USD via eligibility). */}
                <MethodRow
                    selected={method === 'ideal'}
                    eligible={isEligible('ideal')}
                    hint={unavailable}
                    onSelect={() => selectMethod('ideal')}
                    label='iDEAL'
                    logos={
                        <BrandMark
                            src='/icons/payments/pay-4.svg'
                            className='h-6 w-auto'
                        />
                    }>
                    <p className='px-4 pb-[18px] pt-0.5 text-[12.5px] leading-[1.6] text-it-text-muted'>
                        {dict.redirectNote}
                    </p>
                </MethodRow>

                {/* PayPal (redirect). */}
                <MethodRow
                    selected={method === 'paypal'}
                    eligible={isEligible('paypal')}
                    hint={unavailable}
                    onSelect={() => selectMethod('paypal')}
                    label={dict.paypal}
                    logos={
                        <BrandMark
                            src='/icons/payments/pay-3.svg'
                            className='h-6 w-auto'
                        />
                    }>
                    <p className='px-4 pb-[18px] pt-0.5 text-[12.5px] leading-[1.6] text-it-text-muted'>
                        {dict.redirectNote}
                    </p>
                </MethodRow>
            </div>

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
                <span className='text-[14px] font-bold leading-[1.5] text-it-ink'>
                    {label}
                </span>
                {logos && (
                    <span className='ml-auto flex items-center gap-1.5'>
                        {logos}
                    </span>
                )}
            </motion.button>
            {!eligible && (
                <p className='px-4 pb-2.5 text-[12.5px] leading-[1.4] text-it-ink-muted'>
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

