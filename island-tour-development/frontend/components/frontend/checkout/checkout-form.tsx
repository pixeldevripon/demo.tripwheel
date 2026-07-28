'use client';

import {
    createPaymentIntent,
    reserveBooking,
    updateBookingContact,
    type BookingAddOnSelection,
    type ReserveRequest,
} from '@/lib/api/bookings';
import {
    formatCheckoutMoney,
    type BookingSelectionPayload,
} from '@/lib/checkout/checkout';
import { leaveTo } from '@/lib/checkout/leave-to';
import {
    readBookingSelection,
    writeBookingSelection,
} from '@/hooks/tours/use-booking-selection-persistence';
import {
    COUNTRIES,
    composePhone,
    DEFAULT_COUNTRY_CODE,
    POPULAR_CODES,
} from '@/lib/checkout/countries';
import { localizeHref, type Currency, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { readAttribution } from '@/lib/tracking/attribution';
import { storeTravelerSession } from '@/lib/traveler-booking';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
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
import { CheckoutPaymentMollie } from './checkout-payment-mollie';
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
    /** Per-person price (display currency); null = free zone / INCLUDED model. */
    price: number | null;
}

interface CheckoutFormProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Current phase (owned by the parent so the step indicator can live above
     *  the grid); the form advances it via `onPhaseChange`. */
    phase: CheckoutPhase;
    onPhaseChange: (phase: CheckoutPhase) => void;
    /** Publishes the chosen pickup (zone id + label) so the summary mirrors it
     *  live and the parent can re-quote a priced zone (null id = no zone). */
    onPickupChange: (pickup: { id: string | null; label: string | null }) => void;
    /** Pickup options from the tour; empty hides the pickup field. */
    pickupOptions: CheckoutPickupOption[];
    /** Formatted "(From $X p.p.)" suffix for the pickup label, or null. */
    pickupFromLabel: string | null;
    /** Pickup is mandatory (master E.3): no "No pickup" option, choice enforced. */
    pickupRequired: boolean;
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
    /** Optional extras chosen in the widget (carried in the URL). */
    addOns: BookingAddOnSelection[];
    /** For the /payment/processing + TYP hrefs. */
    destination: string;
    slug: string;
    /** True when the traveller was bounced back here after a FAILED charge
     *  (?payment=failed from the processing page) - opens with a message. */
    paymentFailed?: boolean;
}

/**
 * Accordion collapse duration (ms). Shared by the `Collapse` transition and the
 * scroll-into-view below, so the scroll can wait for the layout to settle
 * instead of guessing - keep the two in step.
 */
const COLLAPSE_MS = 350;

/** "Full name" → first / last for the backend ContactDto (both NOT NULL). */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') || firstName;
    return { firstName, lastName };
}

/**
 * Two-phase checkout ACCORDION (master §5.8; Figma 47659:2424 Contact +
 * 47667:15365 Payment): both sections live in one card. Completing Contact
 * reserves the booking (ON_HOLD), attaches contact, and creates the Stripe
 * PaymentIntent - then Contact collapses to a done-summary row (green check +
 * name/email + Edit) and Payment expands in place (`CheckoutPayment`, styled
 * Stripe Card Elements). Edit re-expands Contact and collapses Payment - never
 * a screen swap, and the collapsed sections stay mounted so entries survive an
 * edit round. The persistent booking summary lives alongside (rendered by the
 * page). The charge webhook confirms the booking; the /payment/processing hop
 * polls for it before the thank-you page.
 */
export function CheckoutForm({
    dict,
    locale,
    phase,
    onPhaseChange,
    onPickupChange,
    pickupOptions,
    pickupFromLabel,
    pickupRequired,
    payToday,
    currencySymbol,
    tourId,
    departureId,
    currency,
    quoteId,
    reserveSelection,
    addOns,
    destination,
    slug,
    paymentFailed = false,
}: CheckoutFormProps) {
    // Remember THIS checkout URL (full selection query) per tour, so the
    // processing page can send a failed payment back to the exact same
    // checkout instead of a bare path. The failure flag itself is stripped -
    // it must never restore into a fresh visit.
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('payment');
            window.sessionStorage.setItem(
                `it-checkout-return:${tourId}`,
                url.pathname + url.search
            );
        } catch {
            // Storage unavailable: the processing page falls back to the bare path.
        }
    }, [tourId]);

    // Client idempotency key: a retried reserve (edit contact → Continue again)
    // returns the same booking instead of double-booking. Lazy init dodges the
    // react-hooks purity rule (no impure calls during render).
    const [bookingId] = useState(() => crypto.randomUUID());

    // Set once the reserve + intent succeed; drives the Payment card. The shape
    // follows the admin-selected PSP: Stripe renders inline Card Elements,
    // Mollie renders its Components card form (+ hosted-page fallback) - the
    // Mollie payment itself is only created at Pay, when the card token exists.
    const [intent, setIntent] = useState<
        | {
              provider: 'STRIPE';
              clientSecret: string;
              publishableKey: string;
              publicRef: string;
              methodTypes: string[];
          }
        | {
              provider: 'MOLLIE';
              bookingId: string;
              publicRef: string;
              profileId: string | null;
              testmode: boolean;
          }
        | null
    >(null);
    const [reserving, setReserving] = useState(false);

    const processingBase = localizeHref(
        locale,
        `/${destination}/${slug}/checkout/processing`
    );
    // `tour` rides along so the confirmed handoff can clear this tour's saved
    // widget selection (sessionStorage) - a booked trip must not restore.
    const processingHref = (publicRef: string) =>
        `${processingBase}?ref=${encodeURIComponent(publicRef)}&tour=${encodeURIComponent(tourId)}`;

    // NOT prefetched. The processing route is per-tour and never prerendered,
    // so a router prefetch is answered with the HTML document rather than a
    // flight payload and warms nothing (see `lib/checkout/leave-to.ts`); worse,
    // `processingBase` carries no `?ref`, and that page redirects to the tours
    // list without one - so this only ever warmed a redirect.

    const [contact, setContact] = useState({
        fullName: '',
        email: '',
        country: DEFAULT_COUNTRY_CODE,
        phone: '',
        // Required pickup starts unchosen ('') and is validated on Continue;
        // otherwise the locked default is "No pickup, meet at location".
        pickup: pickupRequired ? '' : 'none',
        special: '',
    });

    // Restore a pickup chosen before a checkout round-trip (same per-tour
    // sessionStorage key the widget's selection persistence uses). The saved
    // value is re-validated: a zone id must still exist on the tour, and a
    // saved "No pickup" is ignored when pickup became required meanwhile.
    useEffect(() => {
        if (pickupOptions.length === 0) return;
        const saved = readBookingSelection(tourId)?.pickup;
        if (!saved) return;
        const zone = pickupOptions.find((o) => o.id === saved);
        const valid =
            zone != null ||
            saved === 'other' ||
            (saved === 'none' && !pickupRequired);
        if (!valid) return;
        setContact((prev) => ({ ...prev, pickup: saved }));
        onPickupChange({
            id: zone?.id ?? null,
            label: zone
                ? zone.label
                : saved === 'other'
                  ? dict.pickupOther
                  : null,
        });
        // Mount-only restore; the props involved are stable for the page life.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const specialId = useId();

    const set = useCallback(
        (key: keyof typeof contact, value: string) =>
            setContact((prev) => ({ ...prev, [key]: value })),
        []
    );

    const countryGroups = useMemo(
        () => [
            { label: dict.countryPopular, options: POPULAR_COUNTRY_OPTIONS },
            { label: dict.countryAll, options: ALL_COUNTRY_OPTIONS },
        ],
        [dict.countryPopular, dict.countryAll]
    );

    // The country field renders ~260 <option> nodes across two <optgroup>s.
    // Every piece of contact state lives on this one component, so without
    // this the whole list was re-reconciled on EVERY keystroke in name, email,
    // phone or the notes textarea - the typing lag on this step. Held as a
    // memoized element so it only re-renders when the country itself changes.
    const countryField = useMemo(
        () => (
            <SelectField
                className='flex-1'
                label={`${dict.country}*`}
                value={contact.country}
                onChange={(v) => set('country', v)}
                groups={countryGroups}
            />
        ),
        [dict.country, contact.country, countryGroups, set]
    );

    // Stable identity so the memoized payment panel below is not re-rendered by
    // unrelated keystrokes during an "Edit contact" round trip.
    const paymentContact = useMemo(
        () => ({
            fullName: contact.fullName,
            email: contact.email.trim(),
            country: contact.country,
        }),
        [contact.fullName, contact.email, contact.country]
    );

    function validateContact(): boolean {
        const next: Record<string, string> = {};
        if (!contact.fullName.trim()) next.fullName = dict.requiredError;
        if (!contact.email.trim()) next.email = dict.requiredError;
        else if (!EMAIL_RE.test(contact.email.trim()))
            next.email = dict.emailError;
        if (!contact.phone.trim()) next.phone = dict.requiredError;
        // Mandatory pickup (master E.3): a zone or the "other location" fallback
        // must be chosen before Continue - the backend rejects the reserve too.
        if (pickupRequired && pickupOptions.length > 0 && !contact.pickup) {
            next.pickup = dict.requiredError;
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    /** Map the pickup select to the reserve pickup fields. */
    function pickupFields(): Pick<
        ReserveRequest,
        'pickupRequested' | 'pickupLocationId'
    > {
        if (contact.pickup === 'none' || contact.pickup === '') {
            return { pickupRequested: false };
        }
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
                ...(addOns.length > 0 ? { addOns } : {}),
                ...pickupFields(),
                notes: contact.special.trim() || undefined,
                // Ad click ids + UTM captured on the landing page (master 8.1.6);
                // written onto the booking on first reserve only.
                attribution: readAttribution() ?? undefined,
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

            // Phase-1 intent: Stripe creates its PaymentIntent here; Mollie
            // only returns the Components profile (the payment is created at
            // Pay, once the card token - or the hosted hand-off - exists).
            const pi = await createPaymentIntent(booking.id);
            if (!pi.paymentRequired) {
                // Nothing due now (OPERATOR_FULL is born CONFIRMED at reserve).
                leaveTo(processingHref(booking.publicRef));
                return;
            }
            if (pi.provider === 'MOLLIE') {
                setIntent({
                    provider: 'MOLLIE',
                    bookingId: booking.id,
                    publicRef: booking.publicRef,
                    profileId: pi.profileId ?? null,
                    testmode: pi.testmode ?? false,
                });
                onPhaseChange('payment');
                return;
            }
            if (!pi.clientSecret || !pi.publishableKey) {
                setFormError(dict.paymentUnavailable);
                setReserving(false);
                return;
            }
            setIntent({
                provider: 'STRIPE',
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

    // Priced zones carry their per-person price inline (master 5.8: "operator
    // zones with prices", no $0.00 decimals - formatCheckoutMoney keeps whole
    // amounts bare); free zones stay a plain label.
    const zoneLabel = (o: CheckoutPickupOption) =>
        o.price != null && o.price > 0
            ? `${o.label} ${dict.pickupPricePP.replace(
                  '{price}',
                  formatCheckoutMoney(o.price, currencySymbol, locale),
              )}`
            : o.label;
    // Required pickup drops "No pickup" and starts on a choose-me placeholder;
    // the "other location via WhatsApp" fallback stays available on both paths.
    const pickupSelectOptions = [
        ...(pickupRequired
            ? [{ value: '', label: dict.pickupSelect }]
            : [{ value: 'none', label: dict.pickupNone }]),
        ...pickupOptions.map((o) => ({ value: o.id, label: zoneLabel(o) })),
        { value: 'other', label: dict.pickupOther },
    ];

    const hasPayment = payToday > 0;
    // Accordion state: Contact is done (collapsed to its summary row) exactly
    // while the Payment phase is active with a ready intent.
    const contactDone = phase === 'payment' && intent !== null;

    // Bring the section that just expanded into view (skip the initial render).
    const cardRef = useRef<HTMLDivElement>(null);
    const paymentHeaderRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(false);
    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }
        const target = contactDone
            ? paymentHeaderRef.current
            : cardRef.current;
        // Wait for the OTHER section to finish collapsing first. It shrinks
        // over COLLAPSE_MS, so the document height keeps changing underneath a
        // scroll started now - the smooth scroll aims at an offset that has
        // moved by the time it arrives, and the traveller lands off-target with
        // the page still settling. Scrolling once the layout is final is both
        // accurate and calmer.
        const timer = setTimeout(() => {
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, COLLAPSE_MS);
        return () => clearTimeout(timer);
    }, [contactDone]);

    return (
        <div ref={cardRef} className={`${cardClass} scroll-mt-24`}>
            {/* Failed-charge return banner (?payment=failed): the traveller is
                back from the PSP with money NOT moved - say so at the very top
                before they re-enter anything. */}
            {paymentFailed && (
                <div className='mb-8 rounded-[8px] border border-it-primary/30 bg-it-primary/5 px-4 py-3 text-[15px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                    {dict.paymentError}
                </div>
            )}
            {/* ── Contact header - swaps to the done-summary row (green check +
                name/email + Edit) once contact completes ── */}
            <div className='flex min-w-0 items-center justify-between gap-4'>
                <div className='flex min-w-0 items-center gap-3'>
                    <SectionBadge
                        number={1}
                        state={contactDone ? 'done' : 'active'}
                    />
                    <span className={`${titleClass} shrink-0`}>
                        {dict.contactDetails}
                    </span>
                    <AnimatePresence initial={false}>
                        {contactDone && (
                            <motion.span
                                key='contact-summary'
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className='min-w-0 truncate text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                                {contact.fullName} · {contact.email.trim()}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
                <AnimatePresence initial={false}>
                    {contactDone && (
                        <motion.button
                            key='contact-edit'
                            type='button'
                            onClick={() => onPhaseChange('contact')}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.2 }}
                            className='shrink-0 cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline underline-offset-2 transition-colors hover:text-it-primary'>
                            {dict.edit}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Contact form body (collapses once contact completes) ── */}
            <Collapse open={!contactDone}>
                    <div className='flex flex-col gap-12 pt-8'>
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
                                    {countryField}
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
                                <div className='flex flex-col gap-2'>
                                    <SelectField
                                        label={
                                            pickupFromLabel
                                                ? `${dict.pickup} ${pickupFromLabel}`
                                                : dict.pickup
                                        }
                                        value={contact.pickup}
                                        onChange={(v) => {
                                            set('pickup', v);
                                            // Survive a round-trip back to the
                                            // widget and returning here again.
                                            writeBookingSelection(tourId, {
                                                pickup: v,
                                            });
                                            if (errors.pickup) {
                                                setErrors((prev) => {
                                                    const rest = { ...prev };
                                                    delete rest.pickup;
                                                    return rest;
                                                });
                                            }
                                            // Publish zone id + label: the label
                                            // mirrors into the summary card, the id
                                            // re-quotes a priced zone's total.
                                            const zone = pickupOptions.find(
                                                (o) => o.id === v,
                                            );
                                            onPickupChange({
                                                id: zone?.id ?? null,
                                                label: zone
                                                    ? zone.label
                                                    : v === 'other'
                                                      ? dict.pickupOther
                                                      : null,
                                            });
                                        }}
                                        options={pickupSelectOptions}
                                        placeholderValue={
                                            pickupRequired ? '' : 'none'
                                        }
                                    />
                                    {errors.pickup && (
                                        <span className='text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                                            {errors.pickup}
                                        </span>
                                    )}
                                </div>
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
            </Collapse>

            {/* ── Payment section - expands in place once contact completes
                (Figma 47659:2424 collapsed footer / 47667:15365 expanded) ── */}
            {hasPayment && (
                <>
                    <div className='-mx-6 mt-8 h-px bg-it-heading/10' />
                    <div
                        ref={paymentHeaderRef}
                        className='mt-8 flex scroll-mt-24 items-center justify-between gap-4'>
                        <div className='flex items-center gap-3'>
                            <SectionBadge
                                number={2}
                                state={contactDone ? 'active' : 'upcoming'}
                            />
                            <span className={titleClass}>{dict.payment}</span>
                        </div>
                        <AnimatePresence initial={false}>
                            {!contactDone && (
                                <motion.span
                                    key='complete-first'
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className='text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50'>
                                    {dict.completeContactFirst}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* Snap OPEN, animate CLOSED. Opening is the direction that
                        matters: the PSP iframes mount on that very render, and
                        an animating zero-height `overflow-hidden` box is the
                        wrong thing to mount them into (see the Collapse doc
                        comment). Nothing mounts on close, so "Edit contact"
                        keeps its 350ms collapse rather than snapping shut. */}
                    <Collapse open={contactDone} instant={contactDone}>
                        {/* Opacity-only reveal keeps the motion without
                            clipping or resizing the iframes. Deliberately no
                            `y`/scale: a transform on an ancestor of a
                            cross-origin iframe is the other thing PSP
                            integrations warn about. */}
                        <motion.div
                            initial={false}
                            animate={{ opacity: contactDone ? 1 : 0 }}
                            transition={{
                                duration: 0.3,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                            className='pt-8'>
                            {/* Mounted from the first successful continue on -
                                collapsing back to edit contact keeps the Stripe
                                fields (and their entries) alive. */}
                            {intent?.provider === 'STRIPE' && (
                                <CheckoutPayment
                                    dict={dict}
                                    locale={locale}
                                    publishableKey={intent.publishableKey}
                                    clientSecret={intent.clientSecret}
                                    contact={paymentContact}
                                    payToday={payToday}
                                    currency={currency}
                                    currencySymbol={currencySymbol}
                                    eligibleMethods={intent.methodTypes}
                                    processingHref={processingHref(
                                        intent.publicRef
                                    )}
                                />
                            )}
                            {/* Mollie: inline Components card form (+ hosted
                                fallback); the payment is created at Pay. */}
                            {intent?.provider === 'MOLLIE' && (
                                <CheckoutPaymentMollie
                                    dict={dict}
                                    locale={locale}
                                    bookingId={intent.bookingId}
                                    profileId={intent.profileId}
                                    testmode={intent.testmode}
                                    payToday={payToday}
                                    currencySymbol={currencySymbol}
                                    processingHref={processingHref(
                                        intent.publicRef
                                    )}
                                />
                            )}
                        </motion.div>
                    </Collapse>
                </>
            )}
        </div>
    );
}

/* ── Accordion primitives ──────────────────────────────────────────── */

type SectionBadgeState = 'active' | 'done' | 'upcoming';

/**
 * 32px numbered circle for a section header: primary-filled while active,
 * green with a white check once done, outlined while upcoming.
 */
function SectionBadge({
    number,
    state,
}: {
    number: number;
    state: SectionBadgeState;
}) {
    return (
        <span
            className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                state === 'done'
                    ? 'bg-it-green'
                    : state === 'active'
                      ? 'bg-it-primary'
                      : 'border border-it-heading/20 bg-it-white'
            }`}>
            <AnimatePresence mode='wait' initial={false}>
                {state === 'done' ? (
                    <motion.span
                        key='check'
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={springPop}
                        className='grid place-items-center'>
                        <Image
                            src='/icons/filters/check-white.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-4 shrink-0'
                        />
                    </motion.span>
                ) : (
                    <motion.span
                        key='number'
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={springPop}
                        className={`font-medium text-[15px] leading-none tracking-[-0.012em] ${
                            state === 'active'
                                ? 'text-it-white'
                                : 'text-it-heading/50'
                        }`}>
                        {number}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

/**
 * Height-collapse section body. Spacing lives INSIDE (pt on the child) so the
 * collapsed state closes fully tight; collapsed content stays mounted (form /
 * Stripe entries survive an edit round) but is inert - no tab stops, no
 * screen-reader exposure.
 *
 * `instant` snaps the height instead of animating it. Pass it for the OPENING
 * of any section holding a PSP iframe: while `height` animates from 0 the box
 * is also `overflow-hidden`, so the Stripe Card Elements and the four Mollie
 * components - which mount on the very render the animation starts - would come
 * up inside a zero-height, clipped container and settle their layout against a
 * box that is still moving. Snapping costs one frame of animation and gives the
 * iframes a settled box to mount into; the reveal keeps its motion via the
 * opacity fade at that call site, which neither clips nor resizes.
 */
function Collapse({
    open,
    instant = false,
    children,
}: {
    open: boolean;
    instant?: boolean;
    children: ReactNode;
}) {
    return (
        <motion.div
            initial={false}
            animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
            transition={
                instant
                    ? { duration: 0 }
                    : { duration: COLLAPSE_MS / 1000, ease: [0.4, 0, 0.2, 1] }
            }
            inert={open ? undefined : true}
            aria-hidden={!open}
            className='overflow-hidden'>
            {children}
        </motion.div>
    );
}
