'use client';

import { formatCheckoutMoney } from '@/lib/checkout/checkout';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { type CheckoutPhase } from './checkout-steps';

type CheckoutDict = Dictionary['checkout'];

/** Curated country + dial-code list (Curaçao default, master §5.8). */
const COUNTRIES: { code: string; label: string }[] = [
    { code: 'CW', label: 'Curacao (+599)' },
    { code: 'AW', label: 'Aruba (+297)' },
    { code: 'SX', label: 'Sint Maarten (+1721)' },
    { code: 'NL', label: 'Netherlands (+31)' },
    { code: 'US', label: 'United States (+1)' },
    { code: 'GB', label: 'United Kingdom (+44)' },
    { code: 'DE', label: 'Germany (+49)' },
    { code: 'FR', label: 'France (+33)' },
    { code: 'ES', label: 'Spain (+34)' },
    { code: 'PT', label: 'Portugal (+351)' },
];

/** A single pickup option offered by the tour (before none/other are added). */
export interface CheckoutPickupOption {
    id: string;
    label: string;
}

const labelClass =
    'font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';
const helperClass =
    'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50';
const inputBase =
    'w-full rounded-[8px] border bg-it-white px-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-heading/30 outline-none transition-colors focus:border-it-primary';

/** Label + text input + optional inline error. */
function Field({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    error,
    className,
    inputMode,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    error?: string;
    className?: string;
    inputMode?: 'text' | 'email' | 'tel' | 'numeric';
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                inputMode={inputMode}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`${inputBase} h-[50px] ${
                    error ? 'border-it-primary' : 'border-it-heading/20'
                }`}
            />
            <AnimatePresence initial={false}>
                {error && (
                    <motion.span
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className='text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                        {error}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Label + native select styled as the Figma box with a trailing chevron. */
function SelectField({
    label,
    value,
    onChange,
    options,
    className,
    placeholderValue,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    className?: string;
    /** Value that renders in the placeholder shade (Figma #2c2c2c @30%). */
    placeholderValue?: string;
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                {label}
            </label>
            <div className='relative'>
                <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputBase} h-[50px] cursor-pointer appearance-none border-it-heading/20 pr-11 ${
                        value === placeholderValue ? 'text-it-heading/30' : ''
                    }`}>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <Image
                    src='/icons/checkout/arrow-down.svg'
                    alt=''
                    width={16}
                    height={16}
                    className='pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2'
                />
            </div>
        </div>
    );
}

/** 24px radio cell holding the 20px ring (Figma Ellipse 10, 1.5px stroke). */
function Radio({ selected }: { selected: boolean }) {
    return (
        <span className='grid size-6 shrink-0 place-items-center'>
            <span
                className={`grid size-5 place-items-center rounded-full border-[1.5px] transition-colors duration-300 ${
                    selected ? 'border-it-primary' : 'border-it-heading'
                }`}>
                <AnimatePresence>
                    {selected && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 30,
                            }}
                            className='size-2.5 rounded-full bg-it-primary'
                        />
                    )}
                </AnimatePresence>
            </span>
        </span>
    );
}

/** Full-width dark commit button (Figma r6, bg #2c2c2c, pad 23/32). */
function DarkButton({
    onClick,
    disabled,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <motion.button
            type='button'
            onClick={onClick}
            disabled={disabled}
            aria-busy={disabled || undefined}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`flex w-full items-center justify-center gap-2.5 rounded-[6px] border-none bg-it-heading px-8 py-[23px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-opacity hover:opacity-90 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
            }`}>
            {children}
        </motion.button>
    );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAY_BRANDS = [
    { key: 'mastercard', icon: '/icons/checkout/brand-mastercard.svg' },
    { key: 'amex', icon: '/icons/checkout/brand-amex.svg' },
    { key: 'visa', icon: '/icons/checkout/brand-visa.svg' },
    { key: 'discover', icon: '/icons/checkout/brand-discover.svg' },
] as const;

type CardBrand = 'card' | (typeof PAY_BRANDS)[number]['key'];

interface CheckoutFormProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Current phase (owned by the parent so the step indicator can live above
     *  the grid); the form advances it via `onPhaseChange`. */
    phase: CheckoutPhase;
    onPhaseChange: (phase: CheckoutPhase) => void;
    /** Pickup options from the tour; empty hides the pickup field. */
    pickupOptions: CheckoutPickupOption[];
    /** Formatted "(From $X p.p.)" suffix for the pickup label, or null. */
    pickupFromLabel: string | null;
    /** Amount charged today; 0 means operator_full (no payment phase). */
    payToday: number;
    currencySymbol: string;
    /** TYP redirect target (`/{destination}/thank-you/{public_ref}`). */
    thankYouHref: string;
}

/**
 * Two-phase checkout form (master §5.8; Figma 47659:2424 Contact +
 * 47667:15365 Payment). The Contact card ends with the collapsed "Payment /
 * Complete Contact first" footer; completing Contact advances to the Payment
 * card. The persistent booking summary lives alongside (rendered by the page).
 *
 * `operator_full` (payToday === 0) takes no payment: there is no Payment phase
 * and Contact commits directly with a bare "Reserve my spot" CTA (conflict logs
 * C22/C23). Live booking submission + Stripe Elements land with the
 * booking/payments module; the CTA is UI-complete but not yet wired.
 */
export function CheckoutForm({
    dict,
    locale,
    phase,
    onPhaseChange,
    pickupOptions,
    pickupFromLabel,
    payToday,
    currencySymbol,
    thankYouHref,
}: CheckoutFormProps) {
    const hasPayment = payToday > 0;
    const router = useRouter();
    const [processing, setProcessing] = useState(false);

    // Warm the TYP route so the post-reserve transition lands on a prefetched
    // page instead of a network round-trip.
    useEffect(() => {
        router.prefetch(thankYouHref);
    }, [router, thankYouHref]);

    const [contact, setContact] = useState({
        fullName: '',
        email: '',
        country: 'CW',
        phone: '',
        pickup: 'none',
        special: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [method, setMethod] = useState<
        'card' | 'paypal' | 'applePay' | 'googlePay'
    >('card');
    /** Which card tile is highlighted while the card method is active. */
    const [cardBrand, setCardBrand] = useState<CardBrand>('card');
    const [card, setCard] = useState({
        number: '',
        expiry: '',
        cvv: '',
        postal: '',
        name: '',
    });
    const [payErrors, setPayErrors] = useState<Record<string, string>>({});
    const specialId = useId();

    const set = (key: keyof typeof contact, value: string) =>
        setContact((prev) => ({ ...prev, [key]: value }));
    const setCardField = (key: keyof typeof card, value: string) =>
        setCard((prev) => ({ ...prev, [key]: value }));

    function validateContact(): boolean {
        const next: Record<string, string> = {};
        if (!contact.fullName.trim()) next.fullName = dict.requiredError;
        if (!contact.email.trim()) next.email = dict.requiredError;
        else if (!EMAIL_RE.test(contact.email.trim()))
            next.email = dict.emailError;
        if (!contact.phone.trim()) next.phone = dict.requiredError;
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    function handleContactContinue() {
        if (!validateContact()) return;
        if (hasPayment) onPhaseChange('payment');
        else handleReserve();
    }

    function validatePayment(): boolean {
        if (method !== 'card') return true;
        const next: Record<string, string> = {};
        if (!card.number.trim()) next.number = dict.requiredError;
        if (!card.expiry.trim()) next.expiry = dict.requiredError;
        if (!card.cvv.trim()) next.cvv = dict.requiredError;
        if (!card.postal.trim()) next.postal = dict.requiredError;
        if (!card.name.trim()) next.name = dict.requiredError;
        setPayErrors(next);
        return Object.keys(next).length === 0;
    }

    function handleReserve() {
        if (processing) return;
        if (hasPayment && !validatePayment()) return;
        // Demo commit: the real booking submission (POST /api/v1/bookings) +
        // Stripe Elements confirm land with the booking/payments module. Until
        // then the CTA shows a short processing state and hands off to the live
        // TYP route with the demo public ref.
        setProcessing(true);
        setTimeout(() => router.push(thankYouHref), 1600);
    }

    const money = (n: number) => formatCheckoutMoney(n, currencySymbol, locale);

    const reserveButton = (onClick: () => void) => (
        <DarkButton onClick={onClick} disabled={processing}>
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
                                    money(payToday),
                                )}
                            </>
                        )}
                    </motion.span>
                )}
            </AnimatePresence>
        </DarkButton>
    );

    const pickupSelectOptions = [
        { value: 'none', label: dict.pickupNone },
        ...pickupOptions.map((o) => ({ value: o.id, label: o.label })),
        { value: 'other', label: dict.pickupOther },
    ];

    const cardClass =
        'rounded-[16px] border border-it-heading/10 bg-it-white p-6';
    const titleClass =
        'font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading';

    return (
        <AnimatePresence mode='wait' initial={false}>
            {phase === 'contact' ? (
                <motion.div
                    key='contact'
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className={cardClass}>
                    <div className='flex flex-col gap-8'>
                        <span className={titleClass}>
                            {dict.contactDetails}
                        </span>

                        <div className='flex flex-col gap-12'>
                            <div className='flex flex-col gap-4'>
                                {/* Full name */}
                                <Field
                                    label={`${dict.fullName}*`}
                                    value={contact.fullName}
                                    onChange={(v) => set('fullName', v)}
                                    error={errors.fullName}
                                />

                                {/* Email */}
                                <div className='flex flex-col gap-2'>
                                    <Field
                                        label={`${dict.email}*`}
                                        type='email'
                                        inputMode='email'
                                        value={contact.email}
                                        onChange={(v) => set('email', v)}
                                        error={errors.email}
                                    />
                                    <span className={helperClass}>
                                        {dict.emailHelper}
                                    </span>
                                </div>

                                {/* Country + phone */}
                                <div className='flex flex-col gap-2'>
                                    <div className='flex flex-col gap-4 sm:flex-row sm:gap-2'>
                                        <SelectField
                                            className='flex-1'
                                            label={`${dict.country}*`}
                                            value={contact.country}
                                            onChange={(v) => set('country', v)}
                                            options={COUNTRIES.map((c) => ({
                                                value: c.code,
                                                label: c.label,
                                            }))}
                                        />
                                        <Field
                                            className='flex-1'
                                            label={`${dict.phone}*`}
                                            type='tel'
                                            inputMode='tel'
                                            value={contact.phone}
                                            onChange={(v) => set('phone', v)}
                                            placeholder={dict.phonePlaceholder}
                                            error={errors.phone}
                                        />
                                    </div>
                                    <span className={helperClass}>
                                        {dict.phoneHelper}
                                    </span>
                                </div>

                                {/* Pickup (only when the tour offers pickup) */}
                                {pickupOptions.length > 0 && (
                                    <SelectField
                                        label={
                                            pickupFromLabel
                                                ? `${dict.pickup} ${pickupFromLabel}`
                                                : dict.pickup
                                        }
                                        value={contact.pickup}
                                        onChange={(v) => set('pickup', v)}
                                        options={pickupSelectOptions}
                                        placeholderValue='none'
                                    />
                                )}

                                {/* Special requests */}
                                <div className='flex flex-col gap-2'>
                                    <div className='flex flex-col gap-2'>
                                        <label
                                            className={labelClass}
                                            htmlFor={specialId}>
                                            {dict.specialRequests}
                                        </label>
                                        <textarea
                                            id={specialId}
                                            value={contact.special}
                                            maxLength={500}
                                            onChange={(e) =>
                                                set('special', e.target.value)
                                            }
                                            placeholder={
                                                dict.specialRequestsPlaceholder
                                            }
                                            className={`${inputBase} h-[95px] resize-none border-it-heading/20 py-3`}
                                        />
                                    </div>
                                    <span className={helperClass}>
                                        {dict.maxChars}
                                    </span>
                                </div>
                            </div>

                            {hasPayment ? (
                                <DarkButton onClick={handleContactContinue}>
                                    {dict.continue}
                                    <Image
                                        src='/icons/checkout/arrow-right-white.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-6 shrink-0'
                                    />
                                </DarkButton>
                            ) : (
                                reserveButton(handleContactContinue)
                            )}
                        </div>
                    </div>

                    {/* Collapsed Payment section (Figma 47659:2424 footer). */}
                    {hasPayment && (
                        <>
                            <div className='-mx-6 mt-14 h-px bg-it-heading/10' />
                            <div className='mt-10 flex items-center justify-between gap-4'>
                                <span className={titleClass}>
                                    {dict.payment}
                                </span>
                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50'>
                                    {dict.completeContactFirst}
                                </span>
                            </div>
                        </>
                    )}
                </motion.div>
            ) : (
                <motion.div
                    key='payment'
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className={`${cardClass} flex flex-col gap-8`}>
                    <span className={titleClass}>{dict.paymentDetails}</span>

                    <div className='flex flex-col gap-12'>
                        <div className='flex flex-col gap-6'>
                            <div className='flex flex-col'>
                                {/* Method selector: card tile + brand tiles */}
                                <div className='flex flex-col gap-2.5'>
                                    <span className={labelClass}>
                                        {dict.selectPaymentMethod}
                                    </span>
                                    <div className='flex w-full max-w-[505px] items-center justify-between gap-2'>
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
                                                method === 'card' &&
                                                cardBrand === 'card'
                                            }
                                            className={`grid h-[50px] w-20 shrink-0 cursor-pointer place-items-center rounded-[8px] border bg-it-white transition-colors duration-300 ${
                                                method === 'card' &&
                                                cardBrand === 'card'
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
                                        {PAY_BRANDS.map((brand) => (
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
                                </div>

                                <AnimatePresence initial={false}>
                                    {method === 'card' && (
                                        <motion.div
                                            key='card-fields'
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                                height: 'auto',
                                                opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                                duration: 0.3,
                                                ease: [0.4, 0, 0.2, 1],
                                            }}
                                            className='overflow-hidden'>
                                            <div className='flex flex-col gap-4 pt-4'>
                                                <Field
                                                    label={dict.cardNumber}
                                                    value={card.number}
                                                    inputMode='numeric'
                                                    onChange={(v) =>
                                                        setCardField(
                                                            'number',
                                                            v,
                                                        )
                                                    }
                                                    placeholder={
                                                        dict.cardNumberPlaceholder
                                                    }
                                                    error={payErrors.number}
                                                />
                                                <div className='flex flex-col gap-4 sm:flex-row sm:gap-2'>
                                                    <Field
                                                        className='flex-1'
                                                        label={dict.expiry}
                                                        value={card.expiry}
                                                        onChange={(v) =>
                                                            setCardField(
                                                                'expiry',
                                                                v,
                                                            )
                                                        }
                                                        placeholder={
                                                            dict.expiryPlaceholder
                                                        }
                                                        error={payErrors.expiry}
                                                    />
                                                    <Field
                                                        className='flex-1'
                                                        label={dict.cvv}
                                                        value={card.cvv}
                                                        inputMode='numeric'
                                                        onChange={(v) =>
                                                            setCardField(
                                                                'cvv',
                                                                v,
                                                            )
                                                        }
                                                        placeholder={
                                                            dict.cvvPlaceholder
                                                        }
                                                        error={payErrors.cvv}
                                                    />
                                                </div>
                                                <Field
                                                    label={`${dict.postalCode}*`}
                                                    value={card.postal}
                                                    onChange={(v) =>
                                                        setCardField(
                                                            'postal',
                                                            v,
                                                        )
                                                    }
                                                    error={payErrors.postal}
                                                />
                                                <Field
                                                    label={dict.nameOnCard}
                                                    value={card.name}
                                                    onChange={(v) =>
                                                        setCardField('name', v)
                                                    }
                                                    error={payErrors.name}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Implied-consent line */}
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
                                                            '/terms',
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
                                                            '/privacy',
                                                        )}
                                                        className='text-it-heading underline underline-offset-2'>
                                                        {dict.consentPrivacy}
                                                    </Link>
                                                );
                                            return <span key={i}>{part}</span>;
                                        })}
                                </span>
                            </div>

                            {/* Express methods */}
                            <div className='flex flex-col gap-4'>
                                {(
                                    [
                                        {
                                            key: 'paypal',
                                            label: dict.paypal,
                                            logo: '/icons/checkout/paypal.svg',
                                        },
                                        {
                                            key: 'applePay',
                                            label: dict.applePay,
                                            logo: '/icons/checkout/apple-pay.svg',
                                        },
                                        {
                                            key: 'googlePay',
                                            label: dict.googlePay,
                                            logo: '/icons/checkout/google-pay.svg',
                                        },
                                    ] as const
                                ).map((m) => (
                                    <div
                                        key={m.key}
                                        className='flex flex-col gap-4'>
                                        <div className='h-px w-full bg-it-heading/10' />
                                        <motion.button
                                            type='button'
                                            onClick={() => setMethod(m.key)}
                                            whileTap={{ scale: 0.99 }}
                                            transition={{
                                                type: 'spring',
                                                stiffness: 500,
                                                damping: 30,
                                            }}
                                            className='flex w-full cursor-pointer items-center gap-4 border-none bg-transparent p-0 text-left'>
                                            <Radio
                                                selected={method === m.key}
                                            />
                                            <span className={labelClass}>
                                                {m.label}
                                            </span>
                                            <Image
                                                src={m.logo}
                                                alt=''
                                                width={74}
                                                height={41}
                                                className='h-[41px] w-[74px] shrink-0'
                                            />
                                        </motion.button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {reserveButton(handleReserve)}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
