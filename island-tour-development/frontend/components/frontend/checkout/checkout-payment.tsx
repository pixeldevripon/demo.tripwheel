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
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { memo, useMemo, useState, type ReactNode } from 'react';
import {
    ConsentLine,
    CtaButton,
    Field,
    FieldShell,
    FreeCancelNote,
    Radio,
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
    currencySymbol: string;
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
    currencySymbol,
    eligibleMethods,
    freeCancelLabel,
    processingHref,
}: CheckoutPaymentProps) {
    const stripe = useStripe();
    const elements = useElements();

    // Card is always offered when eligible; if the intent didn't report methods
    // (older/edge response) fall back to card-only.
    const isEligible = (m: PayMethod) =>
        eligibleMethods.length === 0 ? m === 'card' : eligibleMethods.includes(m);

    const firstEligible: PayMethod =
        (['card', 'ideal', 'paypal'] as PayMethod[]).find(isEligible) ?? 'card';
    const [method, setMethod] = useState<PayMethod>(firstEligible);

    const [card, setCard] = useState({ postal: '', name: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

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

    const money = (n: number) => formatCheckoutMoney(n, currencySymbol, locale);
    const unavailable = dict.methodUnavailable.replace('{currency}', currency);

    async function handleReserve() {
        if (processing || !stripe) return;
        setFormError(null);

        // ── Card: confirm inline (no redirect); 3DS handled by an inline modal. ──
        if (method === 'card') {
            if (!elements) return;
            const next: Record<string, string> = {};
            if (!card.postal.trim()) next.postal = dict.requiredError;
            if (!card.name.trim()) next.name = dict.requiredError;
            setErrors(next);
            if (Object.keys(next).length > 0) return;

            const cardNumber = elements.getElement(CardNumberElement);
            if (!cardNumber) return;

            setProcessing(true);
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardNumber,
                    billing_details: {
                        name: card.name || contact.fullName,
                        email: contact.email,
                        address: {
                            postal_code: card.postal,
                            country: contact.country || undefined,
                        },
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
            <span className='mt-0.5 mb-2.5 text-[13.5px] font-bold leading-[1.5] text-it-ink'>
                {dict.selectPaymentMethod}
            </span>
            <div className='mb-3.5 flex items-center gap-2.5 rounded-it-md border border-it-border bg-it-bg px-3.5 py-[11px] text-[13px] font-bold leading-[1.5] text-it-ink'>
                <Image
                    src='/icons/checkout/lock-ink.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0'
                />
                {dict.secureCheckout}
                <span className='ml-auto inline-flex items-center gap-1 rounded-[4px] bg-[#425466] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.02em] text-it-white'>
                    {dict.poweredBy} <b>Stripe</b>
                </span>
            </div>

            {/* Payment methods - ONE bordered radio list (design v2 .pm):
                hairline-divided rows, tinted selected row, methods expand in
                place under their row. */}
            <div className='overflow-hidden rounded-it-md border-[1.5px] border-it-border bg-it-white'>
                {/* Card */}
                <MethodRow
                    selected={method === 'card'}
                    eligible={isEligible('card')}
                    hint={unavailable}
                    onSelect={() => setMethod('card')}
                    label={dict.card}
                    logos={
                        <>
                            <BrandMark src='/icons/payments/pay-1.svg' />
                            <BrandMark src='/icons/payments/pay-2.svg' />
                            <BrandMark src='/icons/payments/pay-8.svg' />
                        </>
                    }>
                    {/* Card fields (Stripe Card Elements, styled to the mockup;
                        brand auto-detected from the number). */}
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
                                onChange={(e) =>
                                    setErrors((p) => ({
                                        ...p,
                                        number: e.error
                                            ? e.error.message
                                            : '',
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
                                    onChange={(e) =>
                                        setErrors((p) => ({
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
                                    onChange={(e) =>
                                        setErrors((p) => ({
                                            ...p,
                                            cvv: e.error
                                                ? e.error.message
                                                : '',
                                        }))
                                    }
                                    className='w-full'
                                />
                            </FieldShell>
                        </div>
                        <Field
                            label={dict.nameOnCard}
                            value={card.name}
                            onChange={(v) =>
                                setCard((p) => ({ ...p, name: v }))
                            }
                            error={errors.name}
                        />
                        <Field
                            label={dict.postalCode}
                            required
                            value={card.postal}
                            onChange={(v) =>
                                setCard((p) => ({ ...p, postal: v }))
                            }
                            error={errors.postal}
                        />
                    </div>
                </MethodRow>

                {/* iDEAL (EUR-only; auto-disabled for USD via eligibility). */}
                <MethodRow
                    selected={method === 'ideal'}
                    eligible={isEligible('ideal')}
                    hint={unavailable}
                    onSelect={() => setMethod('ideal')}
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
                    onSelect={() => setMethod('paypal')}
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
            <AnimatePresence initial={false}>
                {formError && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className='mt-3 text-[13.5px] leading-[1.6] text-it-primary'>
                        {formError}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Commit CTA: lock + exact amount ("Reserve my spot · Pay $71"). */}
            <div className='mt-5'>
                <CtaButton
                    onClick={handleReserve}
                    disabled={processing || !stripe}>
                    <AnimatePresence mode='wait' initial={false}>
                        {processing ? (
                            <motion.span
                                key='processing'
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.15 }}
                                className='flex items-center gap-2.5'>
                                <span className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white' />
                                {dict.processing}
                            </motion.span>
                        ) : (
                            <motion.span
                                key='label'
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.15 }}
                                className='flex items-center gap-[9px]'>
                                <Image
                                    src='/icons/checkout/lock-white.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-[15px] shrink-0'
                                />
                                {dict.reserve}
                                {payToday > 0 && (
                                    <>
                                        {' · '}
                                        {dict.reservePay.replace(
                                            '{amount}',
                                            money(payToday)
                                        )}
                                    </>
                                )}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </CtaButton>
            </div>

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
    children,
}: {
    selected: boolean;
    eligible: boolean;
    hint: string;
    onSelect: () => void;
    label: string;
    /** Passive network chips at the row's right edge. */
    logos?: ReactNode;
    /** Expanded content under the row while selected. */
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
            {children && (
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            key='expand'
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                            className='overflow-hidden'>
                            {children}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
