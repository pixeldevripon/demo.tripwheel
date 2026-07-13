'use client';

import {
    DUMMY_BOOKING_DATA,
    type BookingBand,
    type TourBookingData,
} from '@/lib/tours/booking';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Shared easing for every expand/collapse (mirrors --it-ease).
const COLLAPSE_EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Smoothly animates its children open/closed by height + fade (framer-motion).
 * `overflow-hidden` clips the content while the height tween runs so nothing
 * jumps. Used for every collapsible region in the booking card.
 */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    key='content'
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: COLLAPSE_EASE }}
                    className='overflow-hidden'>
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export type TourBookingDict = {
    from: string;
    perPerson: string;
    continue: string;
    selected: string;
    soldOut: string;
    /** "Only {count} left" */
    onlyLeft: string;
    /** "{count} Travelers" */
    travelers: string;
    total: string;
    payToday: string;
    balanceLater: string;
    taxesIncluded: string;
    showDetails: string;
    /** Trust line with a `{link}` marker for the clickable part, e.g. "{link} up to {hours}h". */
    freeCancellation: string;
    /** Clickable/underlined phrase inside `freeCancellation` (opens the modal). */
    freeCancellationLink: string;
    /** Trust line with a `{link}` marker, e.g. "{link}, the rest later". */
    payLater: string;
    /** Clickable/underlined phrase inside `payLater` (opens the modal). */
    payLaterLink: string;
    sellOutTitle: string;
    sellOutSubtitle: string;
    // Booking Widget V2
    selectDate: string;
    checkAvailability: string;
    apply: string;
    /** "/per person" */
    perPersonShort: string;
    /** Price label for a free age band (infants). */
    free: string;
    bringingSpectators: string;
    spectatorNote: string;
    yes: string;
    no: string;
    /** Line-item label for spectator rows. */
    spectators: string;
    /** "Only {count} spots left for this departure" (party over slot capacity). */
    capacityNote: string;
    /** Aria-label for the policy-modal close button. */
    policyClose: string;
    /** Free-cancellation policy modal (opened from the trust line). */
    cancellationModal: PolicyModalDict;
    /** Deposit / pay-later policy modal (opened from the trust line). */
    depositModal: PolicyModalDict;
};

/**
 * Content for a policy modal (Figma nodes 48125:20233 / 48125:21537). Every
 * string may carry `{hours}` / `{pct}` placeholders, filled from the tour data.
 */
export type PolicyModalDict = {
    /** Big header title (32px). */
    title: string;
    /** Lead-in heading + paragraph. */
    introTitle: string;
    introBody: string;
    /** Orange "HOW IT WORKS" box: heading + steps. */
    stepsTitle: string;
    steps: string[];
    /** Closing heading + paragraph. */
    outroTitle: string;
    outroBody: string;
};

// A wall-clock "HH:MM" start time formatted for the locale (12h + AM/PM in en,
// 24h in most others). Built on a fixed UTC date so only the clock time shows.
function formatTime(hhmm: string, locale: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) return hhmm;
    const date = new Date(Date.UTC(2000, 0, 1, h, m || 0));
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(date);
}

// "Tue 28 May" - the selected date, locale-formatted.
function formatSelectedDate(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
}

const DAY_MS = 86_400_000;

// Midnight of a date (local), for whole-day comparisons.
function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Monday-first weekday index (Mon=0 … Sun=6) for a JS getDay() (Sun=0 … Sat=6).
function mondayIndex(jsDay: number): number {
    return (jsDay + 6) % 7;
}

// Localized short weekday headers, Monday-first (built off a known Monday).
function weekdayLabels(locale: string): string[] {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) =>
        fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))
    );
}

/** Circular +/- stepper button (Figma node 49212:8122). */
function StepperButton({
    sign,
    label,
    onClick,
    disabled,
}: {
    sign: 'minus' | 'plus';
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type='button'
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className='grid size-10 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-border-subtle bg-transparent transition-colors hover:border-it-heading/40 disabled:cursor-not-allowed disabled:opacity-35'>
            <Image
                src={`/icons/stepper-${sign}.svg`}
                alt=''
                width={20}
                height={20}
                className='size-5 shrink-0'
            />
        </button>
    );
}

/** A count control: (−) N (+) with min/max clamping. */
function Stepper({
    value,
    onChange,
    min,
    max,
    decLabel,
    incLabel,
}: {
    value: number;
    onChange: (next: number) => void;
    min: number;
    max: number;
    decLabel: string;
    incLabel: string;
}) {
    return (
        <div className='flex items-center gap-2.5'>
            <StepperButton
                sign='minus'
                label={decLabel}
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
            />
            <span className='min-w-4 text-center font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                {value}
            </span>
            <StepperButton
                sign='plus'
                label={incLabel}
                disabled={value >= max}
                onClick={() => onChange(value + 1)}
            />
        </div>
    );
}

/**
 * Policy detail modal (Figma "Free cancellation" 48125:20233 / "Pay later"
 * 48125:21537). Both share one shell - white card, 1px ink border, 32px title
 * over a divider, a lead-in block, an orange "HOW IT WORKS" box, and a closing
 * block - so a single component renders either via its `content`. `fill`
 * interpolates the `{hours}` / `{pct}` placeholders from the live tour data.
 */
function PolicyModal({
    open,
    onClose,
    content,
    closeLabel,
    fill,
}: {
    open: boolean;
    onClose: () => void;
    content: PolicyModalDict;
    closeLabel: string;
    fill: (s: string) => string;
}) {
    // Portal target only exists after mount (SSR has no `document`).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Escape-to-close + scroll lock while the modal is open. The frontend
    // reserves the scrollbar gutter permanently (`scrollbar-gutter: stable`),
    // so hiding overflow here never shifts the page layout sideways.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!mounted) return null;

    // Portalled to <body> so it escapes the sticky booking-card stacking
    // context and covers the whole viewport (navbar included).
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className='fixed inset-0 z-[200] flex items-center justify-center p-4'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}>
                    {/* Overlay */}
                    <div
                        className='absolute inset-0 bg-black/30'
                        onClick={onClose}
                        aria-hidden='true'
                    />

                    {/* Panel */}
                    <motion.div
                        role='dialog'
                        aria-modal='true'
                        aria-label={fill(content.title)}
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{
                            duration: 0.22,
                            ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        className='relative flex max-h-[90vh] w-full max-w-[875px] flex-col gap-6 overflow-y-auto rounded-[16px] border-[0.6px] border-it-ink/10 bg-it-white p-5 sm:gap-10 sm:p-6'>
                        {/* Close button (pill, top-right) */}
                        <button
                            type='button'
                            aria-label={closeLabel}
                            onClick={onClose}
                            className='absolute top-5 right-5 z-10 grid size-10 cursor-pointer place-items-center rounded-it-full border border-it-ink/10 bg-it-surface sm:top-6 sm:right-6 sm:size-12'>
                            <Image
                                src='/icons/modal-close.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                        </button>

                        {/* Header: title + divider */}
                        <div className='flex flex-col gap-4'>
                            <h2 className='m-0 pr-12 font-medium text-[20px] leading-[30px] tracking-[-0.3px] text-it-heading sm:pr-14 sm:text-[32px] sm:leading-[38px] sm:tracking-[-0.38px]'>
                                {fill(content.title)}
                            </h2>
                            <div className='h-px w-full bg-it-ink/10' />
                        </div>

                        {/* Body */}
                        <div className='flex flex-col gap-5 sm:gap-6'>
                            <div className='flex flex-col gap-1'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-it-heading'>
                                    {fill(content.introTitle)}
                                </span>
                                <p className='m-0 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-it-heading'>
                                    {fill(content.introBody)}
                                </p>
                            </div>

                            {/* Orange "HOW IT WORKS" box (5% primary tint) */}
                            <div className='flex flex-col gap-2 rounded-[8px] border-[0.6px] border-it-primary/20 bg-it-primary/5 p-4'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-[#8b390e]'>
                                    {fill(content.stepsTitle)}
                                </span>
                                <ol className='m-0 flex list-none flex-col gap-1 p-0'>
                                    {content.steps.map((step, i) => (
                                        <li
                                            key={i}
                                            className='flex gap-1.5 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-[#8b390e]'>
                                            <span>{i + 1}.</span>
                                            <span>{fill(step)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Closing block */}
                            <div className='flex flex-col gap-4'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-it-heading'>
                                    {fill(content.outroTitle)}
                                </span>
                                <p className='m-0 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-it-heading'>
                                    {fill(content.outroBody)}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

/**
 * Tour booking card - the interactive right-rail widget (Figma "Booking Widget
 * V2", node 49213:8098). Drives the full pre-checkout flow client-side:
 *
 *  1. Price header (From {price} per person).
 *  2. Date field -> full-month calendar popover.
 *  3. Departure-time chips (appear once a date is picked).
 *  4. Party selector - Pattern A (single band: inline stepper) or Pattern B
 *     (age-banded: expandable steppers + optional spectators + Apply).
 *  5. Price summary (Total / Pay today / Balance later) once date + time + party
 *     are set, expandable to a per-band line-item breakdown.
 *  6. Continue CTA (label switches from "Check Availability" once ready) + two
 *     trust lines, and a "Likely to sell out" notice beneath the card.
 *
 * Real availability (remaining spots / sold-out slots) and checkout navigation
 * land with the booking module; every offered start time is selectable for now.
 */
export function TourBookingCard({
    dict,
    data = DUMMY_BOOKING_DATA,
    locale = 'en',
}: {
    dict: TourBookingDict;
    /** Live tour data; falls back to `DUMMY_BOOKING_DATA` for design/testing. */
    data?: TourBookingData;
    locale?: string;
}) {
    const participantBands = useMemo(
        () => data.bands.filter(b => b.kind === 'participant'),
        [data.bands]
    );
    const spectatorBands = useMemo(
        () => data.bands.filter(b => b.kind === 'spectator'),
        [data.bands]
    );
    const hasSpectators = spectatorBands.length > 0;
    // Pattern A = a single participant band and no spectators (inline stepper).
    const isPatternB = participantBands.length > 1 || hasSpectators;

    const maxParty = data.maxPartySize ?? 99;

    // Initial counts: the default participant band seeds the min party; everything
    // else starts at zero. (`buildTourBookingData` guarantees ≥1 participant band.)
    const [counts, setCounts] = useState<Record<string, number>>(() => {
        const seed: Record<string, number> = {};
        data.bands.forEach(b => (seed[b.id] = 0));
        const defaultBand =
            participantBands.find(b => b.isDefault) ?? participantBands[0];
        if (defaultBand) seed[defaultBand.id] = Math.max(1, data.minPartySize);
        return seed;
    });

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [partyOpen, setPartyOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [spectatorsOn, setSpectatorsOn] = useState(false);
    // The spectators field only surfaces once the traveller count is touched.
    const [travelerTouched, setTravelerTouched] = useState(false);
    // Set when the spectators choice is applied: the separate spectators block
    // then collapses and the spectator steppers fold into the traveller panel.
    const [spectatorsApplied, setSpectatorsApplied] = useState(false);
    // Flips true on "Check Availability" once the party fits the slot - this is
    // what hides the traveller/spectator selectors and reveals the summary.
    const [availabilityChecked, setAvailabilityChecked] = useState(false);
    // Which policy modal (if any) is open, opened from the trust lines below.
    const [policyModal, setPolicyModal] = useState<
        null | 'cancellation' | 'deposit'
    >(null);
    // `today` is only read once the calendar opens (post-mount) so it never
    // reaches the server-rendered HTML - no hydration mismatch.
    const [today] = useState(() => startOfDay(new Date()));
    const [view, setView] = useState(() => {
        const d = startOfDay(new Date());
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    const travelerCount = data.bands.reduce(
        (n, b) => n + (counts[b.id] ?? 0),
        0
    );

    // The chosen slot and how many spots it has left. A `remaining` of null means
    // ample capacity, so the party is only limited by the tour's max party size.
    const selectedSlot =
        selectedTime != null
            ? (data.slots.find(s => s.time === selectedTime) ?? null)
            : null;
    const slotCapacity = selectedSlot?.remaining ?? maxParty;
    // Largest party allowed right now: the tour max, further capped by the slot.
    const effectiveMax = selectedTime != null
        ? Math.min(maxParty, slotCapacity)
        : maxParty;
    // The party (travellers + spectators) exceeds what this slot can take.
    const overCapacity = selectedTime != null && travelerCount > effectiveMax;

    // `ready` (summary shown, CTA = "Continue") is gated on the availability check.
    const ready = availabilityChecked;
    // Selectors stay editable until the availability check passes.
    const editingParty = !availabilityChecked;

    const lineItems = data.bands
        .map(b => ({ band: b, count: counts[b.id] ?? 0 }))
        .filter(row => row.count > 0);
    const total = lineItems.reduce(
        (sum, row) => sum + row.count * row.band.price,
        0
    );
    const payToday = data.requiresDeposit
        ? Math.round((total * data.depositPct) / 100)
        : total;
    const balanceLater = total - payToday;

    const cur = data.currencySymbol;
    const money = (n: number) => `${cur}${n.toLocaleString(locale)}`;

    // Interpolate policy-copy placeholders from the live tour data.
    const fillPolicy = (s: string) =>
        s
            .replace(/\{hours\}/g, String(data.cancellationHours))
            .replace(/\{pct\}/g, String(data.depositPct));

    function setBandCount(band: BookingBand, next: number) {
        const clamped = Math.max(0, next);
        // Cap the whole party (travellers + spectators) at the effective max
        // (tour max, capped by the selected slot's remaining capacity).
        const others = travelerCount - (counts[band.id] ?? 0);
        if (clamped > (counts[band.id] ?? 0) && others + clamped > effectiveMax) {
            return;
        }
        // Changing the party reveals the spectators field and forces a re-check.
        if (band.kind === 'participant') setTravelerTouched(true);
        setAvailabilityChecked(false);
        setCounts(prev => ({ ...prev, [band.id]: clamped }));
    }

    // The right-hand control in the party header: an inline stepper for Pattern A,
    // otherwise a chevron that expands the panel.
    const partyMin = (band: BookingBand) =>
        band === (participantBands.find(b => b.isDefault) ?? participantBands[0])
            ? Math.min(1, data.minPartySize) // default band floor stays ≥0 but usually 1
            : 0;

    function bandPriceLabel(band: BookingBand): string {
        return band.price > 0
            ? `${money(band.price)}${dict.perPersonShort}`
            : dict.free;
    }

    // ── Calendar grid (Monday-first, prev/next month spill greyed + disabled). ──
    const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
    const calendarCells = useMemo(() => {
        const first = new Date(view.year, view.month, 1);
        const lead = mondayIndex(first.getDay());
        const daysInMonth = new Date(
            view.year,
            view.month + 1,
            0
        ).getDate();
        const cells: { date: Date; inMonth: boolean }[] = [];
        for (let i = 0; i < lead; i++) {
            cells.push({
                date: new Date(view.year, view.month, 1 - (lead - i)),
                inMonth: false,
            });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ date: new Date(view.year, view.month, d), inMonth: true });
        }
        while (cells.length % 7 !== 0) {
            const last = cells[cells.length - 1].date;
            cells.push({
                date: new Date(last.getTime() + DAY_MS),
                inMonth: false,
            });
        }
        return cells;
    }, [view]);

    const monthName = (m: number, y: number) =>
        new Intl.DateTimeFormat(locale, { month: 'long' }).format(
            new Date(y, m, 1)
        );
    const shiftMonth = (delta: number) =>
        setView(v => {
            const d = new Date(v.year, v.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });

    function pickDate(date: Date) {
        setSelectedDate(date);
        setSelectedTime(null);
        setAvailabilityChecked(false);
        setCalendarOpen(false);
    }

    function selectTime(time: string) {
        setSelectedTime(time);
        setAvailabilityChecked(false);
    }

    function handleCtaClick() {
        if (availabilityChecked) return; // Continue -> checkout (booking module).
        if (!selectedDate) {
            setCalendarOpen(true);
            return;
        }
        if (selectedTime == null || travelerCount < 1) return;
        // Party won't fit this slot: keep the selectors open (capped at capacity)
        // so the traveller/spectator counts can be brought down to fit.
        if (overCapacity) {
            if (isPatternB) setPartyOpen(true);
            return;
        }
        setPartyOpen(false);
        setCalendarOpen(false);
        setAvailabilityChecked(true);
    }

    // While editing: Pattern A gets an inline header stepper, Pattern B gets a
    // chevron that expands its age-band steppers. Once the availability check
    // passes the header control disappears and the price summary takes over.
    const headerHasChevron = isPatternB && editingParty;
    const showInlineStepper = !isPatternB && editingParty;
    const showPartyBody = isPatternB && partyOpen && editingParty;

    return (
        <div className='flex flex-col gap-4'>
            {/* Main booking card */}
            <div className='rounded-[16px] bg-it-surface'>
                {/* Price header */}
                <div className='flex items-baseline gap-1 border-b border-it-heading/10 px-4 py-4 text-it-heading'>
                    <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                        {dict.from}
                    </span>
                    <span className='font-bold text-[28px] leading-[1.4] tracking-[-0.012em]'>
                        {money(data.priceFrom)}
                    </span>
                    <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                        {dict.perPerson}
                    </span>
                </div>

                {/* Content: selectors + CTA */}
                <div className='flex flex-col gap-6 p-4'>
                    <div className='flex flex-col gap-2'>
                        {/* Date field + calendar popover */}
                        <div className='relative'>
                            <button
                                type='button'
                                onClick={() => setCalendarOpen(o => !o)}
                                aria-expanded={calendarOpen}
                                className='flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-[8px] bg-it-white px-4 py-4 text-left'>
                                <span
                                    className={`text-[16px] leading-[1.6] tracking-[-0.012em] ${
                                        selectedDate
                                            ? 'text-it-heading'
                                            : 'text-it-ink-placeholder'
                                    }`}>
                                    {selectedDate
                                        ? formatSelectedDate(selectedDate, locale)
                                        : dict.selectDate}
                                </span>
                                <Image
                                    src='/icons/booking-calendar.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                            </button>

                            <AnimatePresence>
                              {calendarOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: COLLAPSE_EASE,
                                    }}
                                    className='absolute top-full left-0 z-50 mt-2 w-full rounded-[16px] bg-it-white p-4 shadow-it-lg'>
                                    {/* Month nav: ← current | year | next → */}
                                    <div className='flex items-center justify-between gap-2 pb-4'>
                                        <button
                                            type='button'
                                            onClick={() => shiftMonth(-1)}
                                            className='flex cursor-pointer items-center gap-2 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            <Image
                                                src='/icons/booking-arrow.svg'
                                                alt=''
                                                width={20}
                                                height={20}
                                                className='size-5 shrink-0 rotate-180'
                                            />
                                            {monthName(view.month, view.year)}
                                        </button>
                                        <span className='font-medium text-[20px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                            {view.year}
                                        </span>
                                        <button
                                            type='button'
                                            onClick={() => shiftMonth(1)}
                                            className='flex cursor-pointer items-center gap-2 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {monthName(
                                                view.month === 11
                                                    ? 0
                                                    : view.month + 1,
                                                view.month === 11
                                                    ? view.year + 1
                                                    : view.year
                                            )}
                                            <Image
                                                src='/icons/booking-arrow.svg'
                                                alt=''
                                                width={20}
                                                height={20}
                                                className='size-5 shrink-0'
                                            />
                                        </button>
                                    </div>

                                    {/* Weekday headers */}
                                    <div className='grid grid-cols-7 gap-y-2 text-center'>
                                        {weekdays.map(w => (
                                            <span
                                                key={w}
                                                className='font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {w}
                                            </span>
                                        ))}
                                        {/* Day cells */}
                                        {calendarCells.map(({ date, inMonth }) => {
                                            const isPast =
                                                date.getTime() < today.getTime();
                                            const disabled = !inMonth || isPast;
                                            const isSelected =
                                                selectedDate != null &&
                                                startOfDay(date).getTime() ===
                                                    startOfDay(
                                                        selectedDate
                                                    ).getTime();
                                            return (
                                                <button
                                                    key={date.toISOString()}
                                                    type='button'
                                                    disabled={disabled}
                                                    onClick={() => pickDate(date)}
                                                    className={`mx-auto grid size-9 place-items-center rounded-it-full text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                                                        isSelected
                                                            ? 'bg-it-primary font-medium text-it-white'
                                                            : disabled
                                                              ? 'cursor-not-allowed text-it-ink-muted/50'
                                                              : 'cursor-pointer text-it-heading hover:bg-it-surface'
                                                    }`}>
                                                    {date.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </div>

                        {/* Departure-time chips (once a date is picked) */}
                        <Collapse open={selectedDate != null && data.slots.length > 0}>
                            <div className='grid grid-cols-3 gap-2'>
                                {data.slots.slice(0, 3).map(slot => {
                                    const isSelected =
                                        selectedTime === slot.time;
                                    const soldOut = slot.status === 'sold_out';
                                    const note = isSelected
                                        ? dict.selected
                                        : soldOut
                                          ? dict.soldOut
                                          : slot.remaining != null
                                            ? dict.onlyLeft.replace(
                                                  '{count}',
                                                  String(slot.remaining)
                                              )
                                            : null;
                                    return (
                                        <button
                                            key={slot.time}
                                            type='button'
                                            disabled={soldOut}
                                            onClick={() => selectTime(slot.time)}
                                            className={`flex flex-col items-center gap-[3px] rounded-[8px] bg-it-white px-4 py-2 ${
                                                isSelected
                                                    ? 'border border-it-primary'
                                                    : 'border border-transparent'
                                            } ${
                                                soldOut
                                                    ? 'cursor-not-allowed opacity-60'
                                                    : 'cursor-pointer'
                                            }`}>
                                            <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {formatTime(slot.time, locale)}
                                            </span>
                                            {note && (
                                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                    {note}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </Collapse>

                        {/* Party selector / price summary panel */}
                        <div className='rounded-[8px] bg-it-white'>
                            {/* Header row */}
                            <div className='flex items-center justify-between gap-2.5 px-4 py-4'>
                                <span className='flex items-center gap-2.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    <Image
                                        src='/icons/booking-travelers.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-6 shrink-0'
                                    />
                                    {dict.travelers.replace(
                                        '{count}',
                                        String(travelerCount)
                                    )}
                                </span>
                                {headerHasChevron && (
                                    <button
                                        type='button'
                                        aria-label={dict.travelers.replace(
                                            '{count}',
                                            String(travelerCount)
                                        )}
                                        aria-expanded={partyOpen}
                                        onClick={() => setPartyOpen(o => !o)}
                                        className='flex cursor-pointer items-center'>
                                        <Image
                                            src='/icons/booking-chevron-down.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className={`size-5 shrink-0 transition-transform ${
                                                partyOpen ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>
                                )}
                                {showInlineStepper && (
                                    <Stepper
                                        value={counts[participantBands[0].id] ?? 0}
                                        min={Math.max(
                                            0,
                                            Math.min(1, data.minPartySize)
                                        )}
                                        max={effectiveMax}
                                        decLabel={`− ${participantBands[0].label}`}
                                        incLabel={`+ ${participantBands[0].label}`}
                                        onChange={n =>
                                            setBandCount(participantBands[0], n)
                                        }
                                    />
                                )}
                            </div>

                            {/* Body: party steppers */}
                            <Collapse open={showPartyBody}>
                                <div className='flex flex-col gap-3.5 px-4 pb-4'>
                                    <div className='h-px w-full bg-it-heading/10' />
                                    {participantBands.map(band => (
                                        <div
                                            key={band.id}
                                            className='flex items-center justify-between gap-1'>
                                            <span className='flex flex-col'>
                                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    {band.label}
                                                </span>
                                                <span className='text-[14px] leading-[1.4] tracking-[-0.012em] text-it-text-muted'>
                                                    {bandPriceLabel(band)}
                                                </span>
                                            </span>
                                            <Stepper
                                                value={counts[band.id] ?? 0}
                                                min={partyMin(band)}
                                                max={effectiveMax}
                                                decLabel={`− ${band.label}`}
                                                incLabel={`+ ${band.label}`}
                                                onChange={n =>
                                                    setBandCount(band, n)
                                                }
                                            />
                                        </div>
                                    ))}

                                    {/* Once spectators are applied, their steppers
                                        fold in here below a separator. */}
                                    {spectatorsApplied && spectatorsOn && (
                                        <>
                                            <div className='h-px w-full bg-it-heading/10' />
                                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {dict.spectators}
                                            </span>
                                            {spectatorBands.map(band => (
                                                <div
                                                    key={band.id}
                                                    className='flex items-center justify-between gap-1'>
                                                    <span className='flex flex-col'>
                                                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                            {band.label}
                                                        </span>
                                                        <span className='text-[14px] leading-[1.4] tracking-[-0.012em] text-it-text-muted'>
                                                            {bandPriceLabel(band)}
                                                        </span>
                                                    </span>
                                                    <Stepper
                                                        value={counts[band.id] ?? 0}
                                                        min={0}
                                                        max={effectiveMax}
                                                        decLabel={`− ${band.label}`}
                                                        incLabel={`+ ${band.label}`}
                                                        onChange={n =>
                                                            setBandCount(band, n)
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </Collapse>

                            {/* Body: price breakdown + totals (once ready).
                                No parent flex-gap around the details Collapse -
                                all its spacing is internal so it collapses without
                                a gap snap. */}
                            <Collapse open={ready}>
                                <div className='flex flex-col px-4 pb-4'>
                                    <div className='h-px w-full bg-it-heading/10' />
                                    <Collapse open={detailsOpen}>
                                        <div className='flex flex-col gap-3.5 pt-3.5'>
                                            <div className='flex flex-col gap-2'>
                                                {lineItems.map(({ band, count }) => (
                                                    <div
                                                        key={band.id}
                                                        className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        <span>
                                                            {`${
                                                                band.kind ===
                                                                'spectator'
                                                                    ? dict.spectators
                                                                    : band.label
                                                            } x ${count} x ${money(
                                                                band.price
                                                            )}`}
                                                        </span>
                                                        <span>
                                                            {money(
                                                                count * band.price
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className='h-px w-full bg-it-heading/10' />
                                        </div>
                                    </Collapse>
                                    <div className='flex flex-col gap-2 pt-3.5'>
                                        <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            <span>{dict.total}</span>
                                            <span>{money(total)}</span>
                                        </div>
                                        {data.requiresDeposit && (
                                            <>
                                                <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    <span>{dict.payToday}</span>
                                                    <span className='text-it-primary'>
                                                        {money(payToday)}
                                                    </span>
                                                </div>
                                                <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    <span>
                                                        {dict.balanceLater}
                                                    </span>
                                                    <span>
                                                        {money(balanceLater)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-ink-muted'>
                                            {dict.taxesIncluded}
                                        </span>
                                    </div>

                                    <button
                                        type='button'
                                        aria-label={dict.showDetails}
                                        aria-expanded={detailsOpen}
                                        onClick={() => setDetailsOpen(o => !o)}
                                        className='flex cursor-pointer items-center justify-center self-center border-none bg-transparent pt-3.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {detailsOpen ? (
                                            <Image
                                                src='/icons/booking-chevron-down.svg'
                                                alt=''
                                                width={20}
                                                height={20}
                                                className='size-5 shrink-0 rotate-180'
                                            />
                                        ) : (
                                            <span className='underline'>
                                                {dict.showDetails}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </Collapse>
                        </div>

                        {/* Spectators panel (separate; Figma nodes 49212:8174 /
                            49212:8187). Shown while selecting; folds into the
                            summary line items once ready. */}
                        <Collapse
                            open={
                                hasSpectators &&
                                travelerTouched &&
                                editingParty &&
                                !spectatorsApplied
                            }>
                            <div className='flex flex-col gap-6 rounded-[8px] bg-it-white px-4 py-6.5'>
                                {spectatorsOn ? (
                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {dict.bringingSpectators}
                                    </span>
                                ) : (
                                    <div className='flex flex-col gap-3.5'>
                                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {dict.bringingSpectators}
                                        </span>
                                        <div className='flex items-center justify-between gap-2'>
                                            {spectatorBands.map((band, i) => (
                                                <span
                                                    key={band.id}
                                                    className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    {i > 0 && (
                                                        <span className='size-1 shrink-0 rounded-full bg-[#d9d9d9]' />
                                                    )}
                                                    {`${band.label.split(' (')[0]} ${money(
                                                        band.price
                                                    )}`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className='grid grid-cols-2 gap-2'>
                                    {[
                                        { on: false, label: dict.no },
                                        { on: true, label: dict.yes },
                                    ].map(opt => {
                                        // Only "Yes" ever shows as active; "No"
                                        // dismisses the block rather than staying lit.
                                        const active = opt.on && spectatorsOn;
                                        return (
                                            <button
                                                key={opt.label}
                                                type='button'
                                                onClick={() => {
                                                    if (opt.on) {
                                                        setSpectatorsOn(true);
                                                        return;
                                                    }
                                                    // "No": clear spectators and
                                                    // remove the block.
                                                    setSpectatorsOn(false);
                                                    spectatorBands.forEach(b =>
                                                        setCounts(prev => ({
                                                            ...prev,
                                                            [b.id]: 0,
                                                        }))
                                                    );
                                                    setSpectatorsApplied(true);
                                                }}
                                                className={`cursor-pointer rounded-[8px] bg-it-surface px-4 py-2 text-center font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors ${
                                                    active
                                                        ? 'border border-it-primary'
                                                        : 'border border-transparent'
                                                }`}>
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <Collapse open={spectatorsOn}>
                                    <div className='flex flex-col gap-3.5'>
                                        <div className='h-px w-full bg-it-heading/10' />
                                        {spectatorBands.map(band => (
                                            <div
                                                key={band.id}
                                                className='flex items-center justify-between gap-1'>
                                                <span className='flex flex-col'>
                                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {band.label}
                                                    </span>
                                                    <span className='text-[14px] leading-[1.4] tracking-[-0.012em] text-it-text-muted'>
                                                        {bandPriceLabel(band)}
                                                    </span>
                                                </span>
                                                <Stepper
                                                    value={counts[band.id] ?? 0}
                                                    min={0}
                                                    max={effectiveMax}
                                                    decLabel={`− ${band.label}`}
                                                    incLabel={`+ ${band.label}`}
                                                    onChange={n =>
                                                        setBandCount(band, n)
                                                    }
                                                />
                                            </div>
                                        ))}
                                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {dict.spectatorNote}
                                        </span>
                                    </div>
                                </Collapse>

                                {/* Apply only surfaces once "Yes" is chosen. */}
                                {spectatorsOn && (
                                    <button
                                        type='button'
                                        onClick={() => setSpectatorsApplied(true)}
                                        className='flex cursor-pointer items-center gap-2.5 self-center border-none bg-transparent font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                        {dict.apply}
                                        <Image
                                            src='/icons/cta-arrow-right.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-5 shrink-0'
                                        />
                                    </button>
                                )}
                            </div>
                        </Collapse>
                    </div>

                    {/* CTA + trust lines */}
                    <div className='flex flex-col gap-5'>
                        {overCapacity && (
                            <span className='text-center text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                                {dict.capacityNote.replace(
                                    '{count}',
                                    String(effectiveMax)
                                )}
                            </span>
                        )}
                        <button
                            type='button'
                            onClick={handleCtaClick}
                            className='flex w-full cursor-pointer items-center justify-center rounded-it-full border-none bg-it-primary px-10 py-[19px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover'>
                            {ready ? dict.continue : dict.checkAvailability}
                        </button>
                        <div className='flex flex-col gap-2'>
                            {[
                                {
                                    modal: 'cancellation' as const,
                                    template: fillPolicy(dict.freeCancellation),
                                    link: fillPolicy(dict.freeCancellationLink),
                                },
                                {
                                    modal: 'deposit' as const,
                                    template: fillPolicy(dict.payLater),
                                    link: fillPolicy(dict.payLaterLink),
                                },
                            ].map(line => {
                                // The trust line carries a `{link}` marker where
                                // the clickable/underlined phrase belongs; only
                                // that phrase opens the policy modal.
                                const [before, after] =
                                    line.template.split('{link}');
                                return (
                                    <span
                                        key={line.modal}
                                        className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        <Image
                                            src='/icons/booking-check.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-5 shrink-0'
                                        />
                                        <span>
                                            {before}
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setPolicyModal(line.modal)
                                                }
                                                className='cursor-pointer border-none bg-transparent p-0 text-left text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline underline-offset-2'>
                                                {line.link}
                                            </button>
                                            {after}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* "Likely to sell out" notice */}
            <div className='flex items-start gap-1 rounded-[16px] bg-it-surface p-4'>
                <Image
                    src='/icons/sell-out.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                <div className='flex flex-col gap-1'>
                    <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {dict.sellOutTitle}
                    </span>
                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.sellOutSubtitle}
                    </span>
                </div>
            </div>

            {/* Policy detail modals (opened from the trust lines) */}
            <PolicyModal
                open={policyModal === 'cancellation'}
                onClose={() => setPolicyModal(null)}
                content={dict.cancellationModal}
                closeLabel={dict.policyClose}
                fill={fillPolicy}
            />
            <PolicyModal
                open={policyModal === 'deposit'}
                onClose={() => setPolicyModal(null)}
                content={dict.depositModal}
                closeLabel={dict.policyClose}
                fill={fillPolicy}
            />
        </div>
    );
}

