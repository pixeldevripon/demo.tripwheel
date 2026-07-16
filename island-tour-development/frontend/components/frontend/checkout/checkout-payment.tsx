'use client';

import { formatCheckoutMoney } from '@/lib/checkout/checkout';
import { localizeHref, type Currency, type Locale } from '@/lib/constants/locales';
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
    DarkButton,
    Field,
    FieldShell,
    labelClass,
    Radio,
    titleClass,
} from './checkout-fields';

type CheckoutDict = Dictionary['checkout'];

/** Card networks shown on the card tile (cosmetic - all mean "card"). */
const CARD_BRANDS = [
    { key: 'mastercard', icon: '/icons/checkout/brand-mastercard.svg' },
    { key: 'amex', icon: '/icons/checkout/brand-amex.svg' },
    { key: 'visa', icon: '/icons/checkout/brand-visa.svg' },
    { key: 'discover', icon: '/icons/checkout/brand-discover.svg' },
] as const;

type PayMethod = 'card' | 'ideal' | 'paypal';

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
    /** Relative TYP-processing path (with ?ref); redirect return_url is built from it. */
    processingHref: string;
}

/**
 * Payment card (Figma 47667:15365) wired to Stripe. Card is collected INLINE via
 * styled Stripe Card Elements (transparent iframes, no Stripe-hosted UI) and
 * confirmed with confirmCardPayment. PayPal + iDEAL confirm client-side and
 * REDIRECT to the provider (return_url -> /payment/processing) - those methods have
 * no fields to collect by design. Methods not in `eligibleMethods` (account /
 * currency ineligible - e.g. iDEAL is EUR-only) render disabled with a hint.
 */
export function CheckoutPayment(props: CheckoutPaymentProps) {
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
}

function PaymentInner({
    dict,
    locale,
    clientSecret,
    contact,
    payToday,
    currency,
    currencySymbol,
    eligibleMethods,
    processingHref,
}: CheckoutPaymentProps) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();

    // Card is always offered when eligible; if the intent didn't report methods
    // (older/edge response) fall back to card-only.
    const isEligible = (m: PayMethod) =>
        eligibleMethods.length === 0 ? m === 'card' : eligibleMethods.includes(m);

    const firstEligible: PayMethod =
        (['card', 'ideal', 'paypal'] as PayMethod[]).find(isEligible) ?? 'card';
    const [method, setMethod] = useState<PayMethod>(firstEligible);
    // Which card tile is highlighted while the card method is active (cosmetic).
    const [cardBrand, setCardBrand] = useState<
        'card' | (typeof CARD_BRANDS)[number]['key']
    >('card');

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
                router.push(processingHref);
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
        <motion.div
            key='payment'
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className='flex flex-col gap-8 rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
            <span className={titleClass}>{dict.paymentDetails}</span>

            <div className='flex flex-col gap-12'>
                <div className='flex flex-col gap-6'>
                    <div className='flex flex-col gap-2.5'>
                        <span className={labelClass}>
                            {dict.selectPaymentMethod}
                        </span>

                        {/* Card: the card tile + brand tiles (all select 'card'),
                            auto-selected. Original Figma design - do not restyle. */}
                        <div className='flex w-full max-w-[505px] flex-wrap items-center gap-2'>
                            <motion.button
                                type='button'
                                onClick={() => {
                                    setMethod('card');
                                    setCardBrand('card');
                                }}
                                whileTap={{ scale: 0.94 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 30,
                                }}
                                aria-label={dict.card}
                                aria-pressed={
                                    method === 'card' && cardBrand === 'card'
                                }
                                className={`grid h-[50px] w-20 shrink-0 cursor-pointer place-items-center rounded-[8px] border bg-it-white transition-colors duration-300 ${
                                    method === 'card' && cardBrand === 'card'
                                        ? 'border-it-primary'
                                        : 'border-it-heading/20'
                                }`}>
                                <Image
                                    src='/icons/checkout/pay-card.svg'
                                    alt=''
                                    width={44}
                                    height={14}
                                    className='h-3.5 w-11 shrink-0'
                                />
                            </motion.button>
                            {CARD_BRANDS.map((brand) => (
                                <motion.button
                                    key={brand.key}
                                    type='button'
                                    onClick={() => {
                                        setMethod('card');
                                        setCardBrand(brand.key);
                                    }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 500,
                                        damping: 30,
                                    }}
                                    aria-label={brand.key}
                                    aria-pressed={
                                        method === 'card' &&
                                        cardBrand === brand.key
                                    }
                                    className={`shrink-0 cursor-pointer rounded-[5px] border bg-transparent p-0 transition-colors duration-300 ${
                                        method === 'card' &&
                                        cardBrand === brand.key
                                            ? 'border-it-primary'
                                            : 'border-transparent'
                                    }`}>
                                    <Image
                                        src={brand.icon}
                                        alt=''
                                        width={74}
                                        height={41}
                                        className='h-[41px] w-[74px] shrink-0'
                                    />
                                </motion.button>
                            ))}
                        </div>

                        {/* Card fields (Stripe Card Elements, styled to Figma). */}
                        <AnimatePresence initial={false}>
                            {method === 'card' && (
                                <motion.div
                                    key='card-fields'
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{
                                        duration: 0.3,
                                        ease: [0.4, 0, 0.2, 1],
                                    }}
                                    className='overflow-hidden'>
                                    <div className='flex flex-col gap-4 pt-4'>
                                        <FieldShell
                                            label={dict.cardNumber}
                                            error={errors.number}>
                                            <CardNumberElement
                                                options={{
                                                    ...elementStyle,
                                                    placeholder:
                                                        dict.cardNumberPlaceholder,
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
                                        <div className='flex flex-col gap-4 sm:flex-row sm:gap-2'>
                                            <FieldShell
                                                className='flex-1'
                                                label={dict.expiry}
                                                error={errors.expiry}>
                                                <CardExpiryElement
                                                    options={{
                                                        ...elementStyle,
                                                        placeholder:
                                                            dict.expiryPlaceholder,
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
                                                        placeholder:
                                                            dict.cvvPlaceholder,
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
                                            label={`${dict.postalCode}*`}
                                            value={card.postal}
                                            onChange={(v) =>
                                                setCard((p) => ({
                                                    ...p,
                                                    postal: v,
                                                }))
                                            }
                                            error={errors.postal}
                                        />
                                        <Field
                                            label={dict.nameOnCard}
                                            value={card.name}
                                            onChange={(v) =>
                                                setCard((p) => ({
                                                    ...p,
                                                    name: v,
                                                }))
                                            }
                                            error={errors.name}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* iDEAL (EUR-only; auto-disabled for USD via eligibility). */}
                        <MethodRow
                            selected={method === 'ideal'}
                            eligible={isEligible('ideal')}
                            hint={unavailable}
                            onSelect={() => setMethod('ideal')}>
                            <span className={labelClass}>iDEAL</span>
                        </MethodRow>

                        {/* PayPal (redirect). */}
                        <MethodRow
                            selected={method === 'paypal'}
                            eligible={isEligible('paypal')}
                            hint={unavailable}
                            onSelect={() => setMethod('paypal')}>
                            <span className={labelClass}>{dict.paypal}</span>
                            <Image
                                src='/icons/checkout/paypal.svg'
                                alt=''
                                width={64}
                                height={24}
                                className='ml-auto h-6 w-16 shrink-0'
                            />
                        </MethodRow>

                        {/* Redirect note for the hosted methods. */}
                        <AnimatePresence initial={false}>
                            {method !== 'card' && (
                                <motion.p
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className='overflow-hidden text-[14px] leading-[1.5] tracking-[-0.012em] text-it-heading/60'>
                                    {dict.redirectNote}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Implied-consent line. */}
                    <div className='flex items-center gap-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        <Image
                            src='/icons/checkout/consent.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6 shrink-0'
                        />
                        <span>
                            {dict.consent
                                .split(/(\{terms\}|\{privacy\})/)
                                .map((part, i) => {
                                    if (part === '{terms}')
                                        return (
                                            <Link
                                                key={i}
                                                href={localizeHref(
                                                    locale,
                                                    '/terms'
                                                )}
                                                className='text-it-heading underline underline-offset-2'>
                                                {dict.consentTerms}
                                            </Link>
                                        );
                                    if (part === '{privacy}')
                                        return (
                                            <Link
                                                key={i}
                                                href={localizeHref(
                                                    locale,
                                                    '/privacy'
                                                )}
                                                className='text-it-heading underline underline-offset-2'>
                                                {dict.consentPrivacy}
                                            </Link>
                                        );
                                    return <span key={i}>{part}</span>;
                                })}
                        </span>
                    </div>
                </div>

                {/* Form-level error (charge failure / unavailable). */}
                <AnimatePresence initial={false}>
                    {formError && (
                        <motion.div
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className='-mt-6 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                            {formError}
                        </motion.div>
                    )}
                </AnimatePresence>

                <DarkButton
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
                                <span className='size-5 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white' />
                                {dict.processing}
                            </motion.span>
                        ) : (
                            <motion.span
                                key='label'
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.15 }}
                                className='flex items-center gap-4'>
                                {dict.reserve}
                                {payToday > 0 && (
                                    <>
                                        <span className='size-1 shrink-0 rounded-full bg-it-white' />
                                        {dict.reservePay.replace(
                                            '{amount}',
                                            money(payToday)
                                        )}
                                    </>
                                )}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </DarkButton>
            </div>
        </motion.div>
    );
}

/**
 * A selectable payment-method row: radio + content. When ineligible it renders
 * dimmed and non-interactive with a hint (master: hide/disable methods that can't
 * take this booking's payment).
 */
function MethodRow({
    selected,
    eligible,
    hint,
    onSelect,
    children,
}: {
    selected: boolean;
    eligible: boolean;
    hint: string;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className='flex flex-col gap-1'>
            <motion.button
                type='button'
                disabled={!eligible}
                onClick={onSelect}
                whileTap={eligible ? { scale: 0.99 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                aria-pressed={selected}
                className={`flex w-full items-center gap-4 rounded-[8px] border bg-it-white px-4 py-3 text-left transition-colors duration-300 ${
                    !eligible
                        ? 'cursor-not-allowed border-it-heading/10 opacity-40'
                        : selected
                          ? 'cursor-pointer border-it-primary'
                          : 'cursor-pointer border-it-heading/20'
                }`}>
                <Radio selected={selected && eligible} />
                {children}
            </motion.button>
            {!eligible && (
                <span className='pl-10 text-[13px] leading-[1.4] tracking-[-0.012em] text-it-heading/40'>
                    {hint}
                </span>
            )}
        </div>
    );
}
