'use client';

import {
    createPaymentIntent,
    reserveBooking,
    updateBookingContact,
    type ReserveRequest,
} from '@/lib/api/bookings';
import type { BookingSelectionPayload } from '@/lib/checkout/checkout';
import {
    COUNTRIES,
    composePhone,
    DEFAULT_COUNTRY_CODE,
    POPULAR_CODES,
} from '@/lib/checkout/countries';
import { localizeHref, type Currency, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { storeTravelerSession } from '@/lib/traveler-booking';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import {
    cardClass,
    DarkButton,
    EMAIL_RE,
    Field,
    helperClass,
    labelClass,
    SelectField,
    titleClass,
} from './checkout-fields';
import { CheckoutPayment } from './checkout-payment';
import { type CheckoutPhase } from './checkout-steps';

type CheckoutDict = Dictionary['checkout'];

/** "Curacao (+599)" - country name with its dial code, for the select option. */
const countryLabel = (c: { name: string; dial: string }) =>
    `${c.name} (+${c.dial})`;

/** Full ISO country list rendered as an option (alphabetical). */
const ALL_COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
    value: c.code,
    label: countryLabel(c),
}));

/** Launch islands + top source markets, pinned to a "Popular" group. */
const POPULAR_COUNTRY_OPTIONS = POPULAR_CODES.map((code) => {
    const c = COUNTRIES.find((x) => x.code === code)!;
    return { value: c.code, label: countryLabel(c) };
});

/** A single pickup option offered by the tour (before none/other are added). */
export interface CheckoutPickupOption {
    id: string;
    label: string;
}

interface CheckoutFormProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Current phase (owned by the parent so the step indicator can live above
     *  the grid); the form advances it via `onPhaseChange`. */
    phase: CheckoutPhase;
    onPhaseChange: (phase: CheckoutPhase) => void;
    /** Publishes the chosen pickup's label so the summary card mirrors it live
     *  (null = nothing chosen yet; the summary falls back to "No pickup"). */
    onPickupLabelChange: (label: string | null) => void;
    /** Pickup options from the tour; empty hides the pickup field. */
    pickupOptions: CheckoutPickupOption[];
    /** Formatted "(From $X p.p.)" suffix for the pickup label, or null. */
    pickupFromLabel: string | null;
    /** Amount charged today; 0 means operator_full (no card step). */
    payToday: number;
    currencySymbol: string;

    // ── Live booking inputs (from the widget selection, carried in the URL) ──
    tourId: string;
    departureId: string | null;
    currency: Currency;
    quoteId: string | null;
    /** Party payload (items/guests); null if the URL selection can't be reserved. */
    reserveSelection: BookingSelectionPayload | null;
    /** For the /payment/processing + TYP hrefs. */
    destination: string;
    slug: string;
}

/** "Full name" → first / last for the backend ContactDto (both NOT NULL). */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') || firstName;
    return { firstName, lastName };
}

/**
 * Two-phase checkout form (master §5.8; Figma 47659:2424 Contact +
 * 47667:15365 Payment). Completing Contact reserves the booking (ON_HOLD),
 * attaches contact, and creates the Stripe PaymentIntent, then advances to the
 * Payment card (`CheckoutPayment`), which confirms the charge with styled Stripe
 * Card Elements. The persistent booking summary lives alongside (rendered by the
 * page). The charge webhook confirms the booking; the /payment/processing hop
 * polls for it before the thank-you page.
 */
export function CheckoutForm({
    dict,
    locale,
    phase,
    onPhaseChange,
    onPickupLabelChange,
    pickupOptions,
    pickupFromLabel,
    payToday,
    currencySymbol,
    tourId,
    departureId,
    currency,
    quoteId,
    reserveSelection,
    destination,
    slug,
}: CheckoutFormProps) {
    const router = useRouter();

    // Client idempotency key: a retried reserve (edit contact → Continue again)
    // returns the same booking instead of double-booking. Lazy init dodges the
    // react-hooks purity rule (no impure calls during render).
    const [bookingId] = useState(() => crypto.randomUUID());

    // Set once the reserve + intent succeed; drives the Payment card.
    const [intent, setIntent] = useState<{
        clientSecret: string;
        publishableKey: string;
        publicRef: string;
        methodTypes: string[];
    } | null>(null);
    const [reserving, setReserving] = useState(false);

    const processingBase = localizeHref(
        locale,
        `/${destination}/${slug}/checkout/processing`
    );
    const processingHref = (publicRef: string) =>
        `${processingBase}?ref=${encodeURIComponent(publicRef)}`;

    // Warm the processing route so the post-reserve transition is instant.
    useEffect(() => {
        router.prefetch(processingBase);
    }, [router, processingBase]);

    const [contact, setContact] = useState({
        fullName: '',
        email: '',
        country: DEFAULT_COUNTRY_CODE,
        phone: '',
        pickup: 'none',
        special: '',
    });

    const countryGroups = [
        { label: dict.countryPopular, options: POPULAR_COUNTRY_OPTIONS },
        { label: dict.countryAll, options: ALL_COUNTRY_OPTIONS },
    ];
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const specialId = useId();

    const set = (key: keyof typeof contact, value: string) =>
        setContact((prev) => ({ ...prev, [key]: value }));

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

    /** Map the pickup select to the reserve pickup fields. */
    function pickupFields(): Pick<
        ReserveRequest,
        'pickupRequested' | 'pickupLocationId'
    > {
        if (contact.pickup === 'none') return { pickupRequested: false };
        if (contact.pickup === 'other') return { pickupRequested: true };
        return { pickupRequested: true, pickupLocationId: contact.pickup };
    }

    async function handleContactContinue() {
        if (reserving) return;
        if (!validateContact()) return;
        setFormError(null);

        if (!departureId || !reserveSelection) {
            // No live departure/party (e.g. a stale or hand-edited URL): can't reserve.
            setFormError(dict.reserveError);
            return;
        }

        setReserving(true);
        try {
            const booking = await reserveBooking({
                id: bookingId,
                tourId,
                departureId,
                currency,
                quoteId: quoteId ?? undefined,
                ...reserveSelection,
                ...pickupFields(),
                notes: contact.special.trim() || undefined,
            });

            const { firstName, lastName } = splitName(contact.fullName);
            const withContact = await updateBookingContact(
                booking.id,
                {
                    firstName,
                    lastName,
                    email: contact.email.trim(),
                    phone:
                        composePhone(contact.country, contact.phone) ||
                        undefined,
                    country: contact.country || undefined,
                    locales: [locale],
                },
                contact.special.trim() || undefined
            );
            // The contact patch issues a traveler session for the booker's
            // email - park it in the HttpOnly cookie now so the TYP (and the
            // cancel page) render verified from the very first load.
            if (withContact.sessionToken) {
                await storeTravelerSession(withContact.sessionToken);
            }

            const pi = await createPaymentIntent(booking.id);
            if (!pi.paymentRequired) {
                // Nothing due now (OPERATOR_FULL is born CONFIRMED at reserve).
                router.push(processingHref(booking.publicRef));
                return;
            }
            if (!pi.clientSecret || !pi.publishableKey) {
                setFormError(dict.paymentUnavailable);
                setReserving(false);
                return;
            }
            setIntent({
                clientSecret: pi.clientSecret,
                publishableKey: pi.publishableKey,
                publicRef: booking.publicRef,
                methodTypes: pi.paymentMethodTypes ?? [],
            });
            onPhaseChange('payment');
        } catch (err) {
            // Log the raw error for debugging; show a clean message (a bare 500
            // "Internal server error" isn't actionable to the traveller).
            console.error('[checkout] reserve/pay failed:', err);
            const raw = err instanceof Error ? err.message : '';
            const isServer500 = /internal server error/i.test(raw);
            setFormError(raw && !isServer500 ? raw : dict.reserveError);
        } finally {
            setReserving(false);
        }
    }

    const pickupSelectOptions = [
        { value: 'none', label: dict.pickupNone },
        ...pickupOptions.map((o) => ({ value: o.id, label: o.label })),
        { value: 'other', label: dict.pickupOther },
    ];

    // Payment phase: the Stripe-wired methods (only once the intent is ready).
    if (phase === 'payment' && intent) {
        return (
            <CheckoutPayment
                dict={dict}
                locale={locale}
                publishableKey={intent.publishableKey}
                clientSecret={intent.clientSecret}
                contact={{
                    fullName: contact.fullName,
                    email: contact.email.trim(),
                    country: contact.country,
                }}
                payToday={payToday}
                currency={currency}
                currencySymbol={currencySymbol}
                eligibleMethods={intent.methodTypes}
                processingHref={processingHref(intent.publicRef)}
            />
        );
    }

    const hasPayment = payToday > 0;

    return (
        <AnimatePresence mode='wait' initial={false}>
            <motion.div
                key='contact'
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className={cardClass}>
                <div className='flex flex-col gap-8'>
                    <span className={titleClass}>{dict.contactDetails}</span>

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
                                        groups={countryGroups}
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
                                    onChange={(v) => {
                                        set('pickup', v);
                                        // Mirror the choice into the summary card.
                                        onPickupLabelChange(
                                            v === 'none'
                                                ? null
                                                : (pickupSelectOptions.find(
                                                      (o) => o.value === v,
                                                  )?.label ?? null),
                                        );
                                    }}
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
                                        className='w-full rounded-[8px] border border-it-heading/20 bg-it-white px-4 py-3 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-heading/30 outline-none transition-colors focus:border-it-primary h-[95px] resize-none'
                                    />
                                </div>
                                <span className={helperClass}>
                                    {dict.maxChars}
                                </span>
                            </div>
                        </div>

                        {/* Form-level error (reserve / payment-setup failure). */}
                        <AnimatePresence initial={false}>
                            {formError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, height: 0 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        height: 'auto',
                                    }}
                                    exit={{ opacity: 0, y: -4, height: 0 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.4, 0, 0.2, 1],
                                    }}
                                    className='-mt-8 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                    {formError}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <DarkButton
                            onClick={handleContactContinue}
                            disabled={reserving}>
                            <AnimatePresence mode='wait' initial={false}>
                                {reserving ? (
                                    <motion.span
                                        key='reserving'
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
                                        key='continue'
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.15 }}
                                        className='flex items-center gap-2.5'>
                                        {dict.continue}
                                        <Image
                                            src='/icons/checkout/arrow-right-white.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6 shrink-0'
                                        />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </DarkButton>
                    </div>
                </div>

                {/* Collapsed Payment section (Figma 47659:2424 footer). */}
                {hasPayment && (
                    <>
                        <div className='-mx-6 mt-14 h-px bg-it-heading/10' />
                        <div className='mt-10 flex items-center justify-between gap-4'>
                            <span className={titleClass}>{dict.payment}</span>
                            <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50'>
                                {dict.completeContactFirst}
                            </span>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
