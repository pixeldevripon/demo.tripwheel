'use client';

import { useCheckoutPrefill } from '@/hooks/checkout/use-checkout-prefill';
import {
    readBookingSelection,
    writeBookingSelection,
} from '@/hooks/tours/use-booking-selection-persistence';
import type { BookingAddOnSelection, ReserveRequest } from '@/lib/api/bookings';
import {
    bookingIdKey,
    formatCheckoutMoney,
    UUID_SHAPE,
    type BookingSelectionPayload,
} from '@/lib/checkout/checkout';
import {
    COUNTRIES,
    DEFAULT_COUNTRY_CODE,
    POPULAR_CODES,
    splitPhone,
} from '@/lib/checkout/countries';
import { leaveTo } from '@/lib/checkout/leave-to';
import { reserveAndPay } from '@/lib/checkout/reserve-and-pay';
import {
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { signOutTraveller } from '@/lib/traveler-booking';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Collapse,
    COLLAPSE_MS,
    ConsentLine,
    CtaButton,
    EMAIL_RE,
    Field,
    FieldError,
    FormError,
    FreeCancelNote,
    helperClass,
    labelClass,
    SectionBadge,
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
const ALL_COUNTRY_OPTIONS = COUNTRIES.map(c => ({
    value: c.code,
    label: countryLabel(c),
}));

/** Launch islands + top source markets, pinned to a "Popular" group. */
const POPULAR_COUNTRY_OPTIONS = POPULAR_CODES.map(code => {
    const c = COUNTRIES.find(x => x.code === code)!;
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
    onPickupChange: (pickup: {
        id: string | null;
        label: string | null;
    }) => void;
    /** Pickup options from the tour; empty hides the pickup field. */
    pickupOptions: CheckoutPickupOption[];
    /** Formatted "(From $X p.p.)" suffix for the pickup label, or null. */
    pickupFromLabel: string | null;
    /** Pickup is mandatory (master E.3): no "No pickup" option, choice enforced. */
    pickupRequired: boolean;
    /** Amount charged today; 0 means operator_full (no card step). */
    payToday: number;
    /** "Free cancellation up to 48h before the tour starts, full refund." -
     *  composed by the page (it owns cancellationHours), shown under the pay CTA. */
    freeCancelLabel: string;

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
    freeCancelLabel,
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

    /**
     * Client idempotency key: a retried reserve (edit contact → Continue
     * again) returns the same booking instead of double-booking. Lazy init
     * dodges the react-hooks purity rule (no impure calls during render).
     *
     * ON A FAILED-PAYMENT RETURN IT IS REUSED, which is the whole point of
     * persisting it. A declined charge deliberately leaves the booking ON_HOLD
     * with its seats still claimed (the backend never cancels it, so the
     * traveller can retry), and the processing page bounces back here with
     * `?payment=failed` - which REMOUNTS this component. Minting a fresh UUID
     * there reserved a SECOND booking and claimed the party's seats a second
     * time, for up to the 30-minute hold window. Two declines on an 8-seat
     * boat left 9 of 8 seats held and the third attempt refused for a
     * departure that was actually empty. Reserve is idempotent on this id and
     * both PSPs handle a retried charge, so reusing it is the correct retry.
     */
    const [bookingId] = useState(() => {
        if (paymentFailed) {
            try {
                const saved = window.sessionStorage.getItem(
                    bookingIdKey(tourId)
                );
                // Shape-checked: sessionStorage is client-writable, and a
                // non-uuid would just 400 at the backend.
                if (saved && UUID_SHAPE.test(saved)) return saved;
            } catch {
                // Storage unavailable - a fresh key still books correctly.
            }
        }
        return crypto.randomUUID();
    });

    // Persist it for exactly that retry. Written on mount rather than after a
    // successful reserve: the charge can fail at any point after the reserve,
    // and the key is useless to anyone else (the booking is worthless without
    // its publicRef, which never lands here).
    useEffect(() => {
        try {
            window.sessionStorage.setItem(bookingIdKey(tourId), bookingId);
        } catch {
            // Storage unavailable: retries mint a new booking, as before.
        }
    }, [tourId, bookingId]);

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
              /** Backend's authoritative charge amount - see `chargeToday`. */
              amount: number | null;
          }
        | {
              provider: 'MOLLIE';
              bookingId: string;
              publicRef: string;
              profileId: string | null;
              testmode: boolean;
              amount: number | null;
          }
        | null
    >(null);
    const [reserving, setReserving] = useState(false);

    /**
     * What the Pay button promises - the BACKEND's figure once we have it.
     *
     * `payToday` is client-side arithmetic (`computeCheckoutTotals`), refreshed
     * from `POST /bookings/quote` only when a priced pickup zone is chosen, and
     * that re-quote swallows its own failures and keeps the previous totals. So
     * a failed re-quote left the CTA reading "Reserve my spot · Pay $X" while
     * `reserve` recomputed server-side WITH the pickup surcharge and charged
     * $X + pickup. The backend hands us the real number on the payment intent
     * and we were discarding it; a button that names a price must name the one
     * that will be charged.
     */
    const chargeToday = intent?.amount ?? payToday;

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

    // Split names (mockup + dev spec §2: Enhanced Conversions match rate) -
    // the backend ContactDto takes firstName/lastName separately anyway.
    const [contact, setContact] = useState({
        firstName: '',
        lastName: '',
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
        const zone = pickupOptions.find(o => o.id === saved);
        const valid =
            zone != null ||
            saved === 'other' ||
            (saved === 'none' && !pickupRequired);
        if (!valid) return;
        setContact(prev => ({ ...prev, pickup: saved }));
        publishPickup(saved);
        // Mount-only restore; the props involved are stable for the page life.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const specialId = useId();

    /**
     * Write a contact field and drop any error sitting on it.
     *
     * The errors map is rebuilt only on submit, so a message used to survive
     * the traveller fixing the field: a filled-in box kept its red border and
     * "This field is required" until they pressed Continue again (test report
     * 2026-08-01, seen on the card postal code and true of every field here).
     * Pickup had grown its own hand-rolled version of this; clearing centrally
     * means the next field added cannot forget to.
     *
     * Clears rather than re-validates - checking on each keystroke would flash
     * the error back while a value is half-typed. Submit stays the authority.
     */
    const set = useCallback((key: keyof typeof contact, value: string) => {
        setContact(prev => ({ ...prev, [key]: value }));
        setErrors(prev => {
            if (!prev[key]) return prev;
            const { [key]: _cleared, ...rest } = prev;
            return rest;
        });
    }, []);

    // ── Signed-in traveller: prefill, and pin the booking to their account ──
    // §Traveler.1 and §Traveler.4 of the 2026-08-01 test report are one root
    // cause seen from two sides. The form knew nothing about the session, so a
    // returning traveller retyped everything they had already given us AND
    // could type any address - and a different one silently opened a SECOND
    // customer account with the booking attached to it, orphaned from the one
    // they were signed into. Now the session email is asserted, not asked for.
    const [prefillKey, setPrefillKey] = useState(0);
    const prefill = useCheckoutPrefill(prefillKey);
    // Only once the lookup settles: locking on a loading answer would flash a
    // disabled field at a guest who has no session at all.
    const lockedEmail = prefill.resolved ? prefill.email : null;

    // Fill what the traveller has not typed. Deliberately never overwrites
    // input: someone who started filling the form before the lookup landed
    // keeps every character of it. The email is the exception - it is asserted,
    // and the field renders read-only below.
    useEffect(() => {
        const email = prefill.resolved ? prefill.email : null;
        if (!email) return;
        const { country, local } = splitPhone(prefill.phone, prefill.country);
        setContact(prev => ({
            ...prev,
            firstName: prev.firstName || (prefill.firstName ?? ''),
            lastName: prev.lastName || (prefill.lastName ?? ''),
            email,
            phone: prev.phone || local,
            // Only when still on the untouched default - a country the
            // traveller picked themselves outranks the stored one.
            country:
                prev.country === DEFAULT_COUNTRY_CODE
                    ? (country ?? prev.country)
                    : prev.country,
        }));
        // Anything the prefill just filled cannot still be "required".
        setErrors({});
    }, [prefill]);

    /**
     * "Use a different email". Booking under another address means booking as
     * someone else, so this signs the traveller out rather than pretending the
     * two identities can coexist - which is exactly the confusion the report
     * describes. It also releases the HttpOnly session, leaving checkout free
     * to mint this booking's own token at the contact step.
     */
    async function handleUseAnotherEmail() {
        await signOutTraveller();
        setContact(prev => ({ ...prev, email: '' }));
        setPrefillKey(k => k + 1);
    }

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
                label={dict.country}
                required
                value={contact.country}
                onChange={v => set('country', v)}
                groups={countryGroups}
            />
        ),
        [dict.country, contact.country, countryGroups, set]
    );

    // Stable identity so the memoized payment panel below is not re-rendered by
    // unrelated keystrokes during an "Edit contact" round trip.
    const paymentContact = useMemo(
        () => ({
            fullName: `${contact.firstName} ${contact.lastName}`.trim(),
            email: contact.email.trim(),
            country: contact.country,
        }),
        [contact.firstName, contact.lastName, contact.email, contact.country]
    );

    function validateContact(): boolean {
        const next: Record<string, string> = {};
        if (!contact.firstName.trim()) next.firstName = dict.requiredError;
        if (!contact.lastName.trim()) next.lastName = dict.requiredError;
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

    /**
     * Publish the chosen pickup as {id, label} to the summary.
     *
     * ONE derivation. The restore path and the interactive path both have to
     * produce the same shape - the label mirrors into the summary card, the id
     * re-quotes a priced zone - and they were deriving it separately, so a
     * change to the none/other labelling in one made the summary read
     * differently after a checkout round-trip than after a fresh pick.
     */
    function publishPickup(value: string) {
        const zone = pickupOptions.find(o => o.id === value);
        onPickupChange({
            id: zone?.id ?? null,
            label: zone
                ? zone.label
                : value === 'other'
                  ? dict.pickupOther
                  : null,
        });
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
        // The transaction itself lives in `lib/checkout/reserve-and-pay.ts` so
        // it can be unit-tested; everything below is the React half.
        const result = await reserveAndPay({
            bookingId,
            tourId,
            departureId,
            currency,
            quoteId,
            selection: reserveSelection,
            addOns,
            pickup: pickupFields(),
            locale,
            contact,
        });

        switch (result.kind) {
            case 'noPayment':
                // Navigating; deliberately leave `reserving` true so the button
                // stays busy until the document swaps.
                leaveTo(processingHref(result.publicRef));
                return;
            case 'mollie':
                setIntent({
                    provider: 'MOLLIE',
                    bookingId: result.bookingId,
                    publicRef: result.publicRef,
                    profileId: result.profileId,
                    testmode: result.testmode,
                    amount: result.amount,
                });
                onPhaseChange('payment');
                break;
            case 'stripe':
                setIntent({
                    provider: 'STRIPE',
                    clientSecret: result.clientSecret,
                    publishableKey: result.publishableKey,
                    publicRef: result.publicRef,
                    methodTypes: result.methodTypes,
                    amount: result.amount,
                });
                onPhaseChange('payment');
                break;
            case 'paymentUnavailable':
                setFormError(dict.paymentUnavailable);
                break;
            case 'error':
                setFormError(result.message ?? dict.reserveError);
                break;
        }
        setReserving(false);
    }

    // Priced zones carry their per-person price inline (master 5.8: "operator
    // zones with prices", no $0.00 decimals - formatCheckoutMoney keeps whole
    // amounts bare); free zones stay a plain label.
    const zoneLabel = (o: CheckoutPickupOption) =>
        o.price != null && o.price > 0
            ? `${o.label} ${dict.pickupPricePP.replace(
                  '{price}',
                  formatCheckoutMoney(o.price, currency, locale)
              )}`
            : o.label;
    // Required pickup drops "No pickup" and starts on a choose-me placeholder;
    // the "other location via WhatsApp" fallback stays available on both paths.
    const pickupSelectOptions = [
        ...(pickupRequired
            ? [{ value: '', label: dict.pickupSelect }]
            : [{ value: 'none', label: dict.pickupNone }]),
        ...pickupOptions.map(o => ({ value: o.id, label: zoneLabel(o) })),
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
        const target = contactDone ? paymentHeaderRef.current : cardRef.current;
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
        // Design v2 .acc: one white card, sections divided by hairlines; the
        // heads carry the padding so the card itself has none.
        <div
            ref={cardRef}
            className='scroll-mt-24 overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm'>
            {/* Failed-charge return banner (?payment=failed): the traveller is
                back from the PSP with money NOT moved - say so at the very top
                before they re-enter anything. */}
            {paymentFailed && (
                <div className='px-[22px] pt-[18px]'>
                    <div className='rounded-it-sm border border-it-primary/30 bg-it-primary-subtle px-3.5 py-3 text-[13.5px] leading-[1.6] text-it-primary-hover'>
                        {dict.paymentError}
                    </div>
                </div>
            )}
            {/* ── Contact header - swaps to the done-summary row (green check +
                name/email + Edit) once contact completes ── */}
            <div className='flex min-w-0 items-center gap-3 px-[22px] py-[18px]'>
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
                            className='min-w-0 truncate text-[13px] leading-[1.6] text-it-text-muted'>
                            · {contact.firstName} {contact.lastName} ·{' '}
                            {contact.email.trim()}
                        </motion.span>
                    )}
                </AnimatePresence>
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
                            className='ml-auto shrink-0 cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-2'>
                            {dict.edit}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Contact form body (collapses once contact completes) ── */}
            <Collapse open={!contactDone}>
                <div className='flex flex-col px-[22px] pb-6 pt-0.5'>
                    <div className='flex flex-col gap-4'>
                        {/* Split names (mockup .row2) */}
                        <div className='flex flex-col gap-4 sm:flex-row sm:gap-3.5'>
                            <Field
                                className='flex-1'
                                label={dict.firstName}
                                required
                                value={contact.firstName}
                                onChange={v => set('firstName', v)}
                                error={errors.firstName}
                            />
                            <Field
                                className='flex-1'
                                label={dict.lastName}
                                required
                                value={contact.lastName}
                                onChange={v => set('lastName', v)}
                                error={errors.lastName}
                            />
                        </div>

                        {/* Email. Locked to the signed-in traveller's own
                                address: the booking is filed under whatever is
                                typed here, so a free-text field let a signed-in
                                traveller quietly file their trip on a second,
                                unreachable account (report §Traveler.4). */}
                        <div className='flex flex-col gap-1.5'>
                            <Field
                                label={dict.email}
                                required
                                type='email'
                                inputMode='email'
                                value={contact.email}
                                onChange={v => set('email', v)}
                                error={errors.email}
                                readOnly={!!lockedEmail}
                            />
                            {lockedEmail ? (
                                <span
                                    className={`${helperClass} flex flex-wrap items-center gap-x-1.5 gap-y-0.5`}>
                                    {dict.signedInAs.replace(
                                        '{email}',
                                        lockedEmail
                                    )}
                                    <button
                                        type='button'
                                        onClick={() =>
                                            void handleUseAnotherEmail()
                                        }
                                        className='cursor-pointer border-none bg-transparent p-0 font-semibold text-it-primary underline underline-offset-2'>
                                        {dict.useAnotherEmail}
                                    </button>
                                </span>
                            ) : (
                                <span className={helperClass}>
                                    {dict.emailHelper}
                                </span>
                            )}
                        </div>

                        {/* Country + phone */}
                        <div className='flex flex-col gap-1.5'>
                            <div className='flex flex-col gap-4 sm:flex-row sm:gap-3.5'>
                                {countryField}
                                <Field
                                    className='flex-1'
                                    label={dict.phone}
                                    required
                                    type='tel'
                                    inputMode='tel'
                                    value={contact.phone}
                                    onChange={v => set('phone', v)}
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
                                    onChange={v => {
                                        // `set` already clears errors.pickup -
                                        // pickup used to hand-roll its own
                                        // clear, which is the exact thing
                                        // centralising `set` was meant to stop.
                                        set('pickup', v);
                                        // Survive a round-trip back to the
                                        // widget and returning here again.
                                        writeBookingSelection(tourId, {
                                            pickup: v,
                                        });
                                        publishPickup(v);
                                    }}
                                    options={pickupSelectOptions}
                                    placeholderValue={
                                        pickupRequired ? '' : 'none'
                                    }
                                />
                                <FieldError error={errors.pickup} />
                            </div>
                        )}

                        {/* Special requests */}
                        <div className='flex flex-col gap-1.5'>
                            <label className={labelClass} htmlFor={specialId}>
                                {dict.specialRequests}
                            </label>
                            <textarea
                                id={specialId}
                                value={contact.special}
                                maxLength={500}
                                onChange={e => set('special', e.target.value)}
                                placeholder={dict.specialRequestsPlaceholder}
                                className='h-[70px] w-full resize-none rounded-it-sm border border-it-border bg-it-white px-[13px] py-[11px] text-[14px] leading-[1.5] text-it-ink placeholder:text-it-ink-muted outline-none transition-colors focus:border-it-primary'
                            />
                            <span className={helperClass}>{dict.maxChars}</span>
                        </div>
                    </div>

                    {/* Form-level error (reserve / payment-setup failure). */}
                    <FormError error={formError} />

                    <div className='mt-5'>
                        <CtaButton
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
                                        <span className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white' />
                                        {dict.processing}
                                    </motion.span>
                                ) : (
                                    <motion.span
                                        key='continue'
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.15 }}
                                        className='flex items-center gap-[9px]'>
                                        {/* operator_full has no payment step:
                                                this button IS the commit (mockup
                                                .commitblock - bare reserve CTA). */}
                                        {hasPayment
                                            ? dict.continue
                                            : dict.reserve}
                                        {hasPayment && (
                                            <Image
                                                src='/icons/checkout/arrow-right-white.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-4 shrink-0'
                                            />
                                        )}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </CtaButton>
                    </div>

                    {/* operator_full: the free-cancel + consent reassurance
                            belongs to the committing action, which is THIS
                            button when no payment section follows. */}
                    {!hasPayment && (
                        <>
                            <FreeCancelNote label={freeCancelLabel} />
                            <ConsentLine
                                consent={dict.consent}
                                consentTerms={dict.consentTerms}
                                consentPrivacy={dict.consentPrivacy}
                                locale={locale}
                            />
                        </>
                    )}
                </div>
            </Collapse>

            {/* ── Payment section - expands in place once contact completes
                (design v2 .acc-sec, hairline-divided) ── */}
            {hasPayment && (
                <>
                    <div
                        ref={paymentHeaderRef}
                        className='flex scroll-mt-24 items-center gap-3 border-t border-it-divider px-[22px] py-[18px]'>
                        <SectionBadge
                            number={2}
                            state={contactDone ? 'active' : 'upcoming'}
                        />
                        <span className={titleClass}>{dict.payment}</span>
                        <AnimatePresence initial={false}>
                            {!contactDone && (
                                <motion.span
                                    key='complete-first'
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className='ml-auto text-right text-[12.5px] leading-[1.6] text-it-ink-muted'>
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
                            className='px-[22px] pb-6 pt-0.5'>
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
                                    payToday={chargeToday}
                                    currency={currency}
                                    eligibleMethods={intent.methodTypes}
                                    freeCancelLabel={freeCancelLabel}
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
                                    payToday={chargeToday}
                                    currency={currency}
                                    freeCancelLabel={freeCancelLabel}
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

