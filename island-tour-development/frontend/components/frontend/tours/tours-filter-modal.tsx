'use client';

import type { Currency, Locale } from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import { PRICE_MAX, PRICE_MIN } from '@/lib/tours/filters';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────────── */

export type ToursFilterModalDict = {
    title: string;
    price: string;
    duration: string;
    durations: {
        upTo2: string;
        '2to4': string;
        '4to6': string;
        fullDay: string;
    };
    timeOfDay: string;
    times: { morning: string; afternoon: string; evening: string };
    freeCancellation: string;
    freeCancellationNote: string;
    cancellationLabel: string;
    cancellation: { '24h': string; '48h': string; '72h': string };
    pickupAvailable: string;
    /** Sub-copy under the pickup toggle - expectation-setting line. */
    pickupNote: string;
    ratings: string;
    clearAll: string;
    applyFilters: string;
};

export type TourFilters = {
    price: [number, number];
    durations: string[];
    times: string[];
    cancellation: string | null;
    pickupAvailable: boolean;
    rating: string | null;
};

// Canonical bounds live in `@/lib/tours/filters` (shared with the server); re-export
// so existing consumers importing them from here keep working.
export { PRICE_MAX, PRICE_MIN } from '@/lib/tours/filters';

export const EMPTY_FILTERS: TourFilters = {
    price: [PRICE_MIN, PRICE_MAX],
    durations: [],
    times: [],
    cancellation: null,
    pickupAvailable: false,
    rating: null,
};

/**
 * Count active filters - drives the toolbar badge. `priceMax` is the effective
 * (per-destination) price ceiling so a full-range slider isn't counted.
 */
export function countActiveFilters(
    f: TourFilters,
    priceMax: number = PRICE_MAX
): number {
    return (
        f.durations.length +
        f.times.length +
        (f.cancellation ? 1 : 0) +
        (f.pickupAvailable ? 1 : 0) +
        (f.rating ? 1 : 0) +
        (f.price[0] > PRICE_MIN || f.price[1] < priceMax ? 1 : 0)
    );
}

/* ── Control atoms (design v2) ─────────────────────────────────────── */

/**
 * Option chip (.fopt): bordered pill; the selected state swaps to the warm
 * cta tint with the deep-orange text. One atom for multi-select (durations,
 * times) and single-select (cancellation, ratings) alike - the caller owns
 * the toggle semantics.
 */
function OptChip({
    on,
    onClick,
    children,
}: {
    on: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <motion.button
            type='button'
            aria-pressed={on}
            onClick={onClick}
            whileTap={{ scale: 0.97 }}
            transition={springPop}
            className={`cursor-pointer whitespace-nowrap rounded-it-full border px-[15px] py-2 text-[13px] leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) ${
                on
                    ? 'border-it-primary bg-it-primary-subtle font-bold text-it-primary-hover'
                    : 'border-it-border bg-it-white font-semibold text-it-ink'
            }`}>
            {children}
        </motion.button>
    );
}

/** Green switch (.toggle): 46x26 pill, green when on. */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
    return (
        <motion.button
            type='button'
            role='switch'
            aria-checked={on}
            onClick={onChange}
            transition={springPop}
            className={`relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-it-full border-none p-0 transition-colors duration-(--it-duration-sm) ease-(--it-ease) ${
                on ? 'bg-it-green' : 'bg-it-border'
            }`}>
            <motion.span
                animate={{ x: on ? 20 : 0 }}
                transition={springPop}
                className='absolute left-[3px] top-[3px] size-5 rounded-full bg-it-white shadow-it-sm'
            />
        </motion.button>
    );
}

export function PriceRange({
    value,
    onChange,
    max = PRICE_MAX,
}: {
    value: [number, number];
    onChange: (v: [number, number]) => void;
    max?: number;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<null | 0 | 1>(null);
    const span = Math.max(1, max - PRICE_MIN);
    // 0..1 position of a value within the track.
    const frac = (v: number) => (v - PRICE_MIN) / span;
    // Percentage position (0–100) for inline style props.
    const pct = (v: number) => frac(v) * 100;

    useEffect(() => {
        if (drag === null) return;
        const move = (e: PointerEvent) => {
            const track = trackRef.current;
            if (!track) return;
            const rect = track.getBoundingClientRect();
            const ratio = Math.min(
                1,
                Math.max(0, (e.clientX - rect.left) / rect.width)
            );
            const raw = Math.round((PRICE_MIN + ratio * span) / 10) * 10;
            if (drag === 0) onChange([Math.min(raw, value[1]), value[1]]);
            else onChange([value[0], Math.max(raw, value[0])]);
        };
        const up = () => setDrag(null);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, [drag, value, onChange, span]);

    return (
        // Design v2 slider: slim track, the selected span in the cta orange,
        // white handles riding the track.
        <div ref={trackRef} className='relative my-1.5 flex h-4 items-center'>
            <span className='absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-it-full bg-it-border' />
            <span
                className='absolute top-1/2 h-1.5 -translate-y-1/2 rounded-it-full bg-it-primary'
                style={{
                    left: `${pct(value[0])}%`,
                    right: `${100 - pct(value[1])}%`,
                }}
            />
            {([0, 1] as const).map(i => (
                <button
                    key={i}
                    type='button'
                    aria-label={i === 0 ? 'Minimum price' : 'Maximum price'}
                    onPointerDown={() => setDrag(i)}
                    style={{ left: `calc(8px + ${pct(value[i])}% * 0.96)` }}
                    className='absolute size-4 -translate-x-1/2 cursor-grab touch-none rounded-full border border-it-border bg-it-white shadow-it-sm active:cursor-grabbing'
                />
            ))}
        </div>
    );
}

/** Section wrapper (.fsec): title + content with the divider hairline. */
function Section({
    title,
    children,
}: {
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex flex-col border-b border-it-divider py-4 last:border-b-0'>
            {title && (
                <h4 className='m-0 mb-3 text-[14px] font-bold leading-[1.6] text-it-ink'>
                    {title}
                </h4>
            )}
            {children}
        </div>
    );
}

/* ── Modal ─────────────────────────────────────────────────────────── */

interface ToursFilterModalProps {
    open: boolean;
    onClose: () => void;
    dict: ToursFilterModalDict;
    /** Currently-applied filters (the modal opens pre-filled with these). */
    value: TourFilters;
    onApply: (filters: TourFilters) => void;
    /** Ratings section stays hidden until tours in this catalogue have reviews. */
    hasReviews?: boolean;
    /** Effective price ceiling for this destination/category (slider max). */
    priceMax?: number;
    /**
     * Display currency + locale for the slider's bound labels. Required rather
     * than defaulted: the labels used to hardcode `$`, which is wrong on a
     * multi-currency platform - the bounds are in whatever currency the rest of
     * the page is priced in, and a wrong symbol misstates the price.
     */
    currency: Currency;
    locale: Locale;
}

export function ToursFilterModal({
    open,
    onClose,
    dict,
    value,
    onApply,
    hasReviews = false,
    priceMax = PRICE_MAX,
    currency,
    locale,
}: ToursFilterModalProps) {
    const [draft, setDraft] = useState<TourFilters>(value);

    // Re-sync the draft each time the modal opens.
    useEffect(() => {
        if (open) setDraft(value);
    }, [open, value]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);

        // iOS-safe scroll lock: position:fixed prevents Safari viewport scroll;
        // we save & restore scrollY so the page doesn't jump on close.
        const scrollY = window.scrollY;
        const body = document.body;
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.width = '100%';

        return () => {
            window.removeEventListener('keydown', onKey);
            body.style.overflow = '';
            body.style.position = '';
            body.style.top = '';
            body.style.width = '';
            window.scrollTo(0, scrollY);
        };
    }, [open, onClose]);

    const toggleArray = (key: 'durations' | 'times', v: string) =>
        setDraft(d => ({
            ...d,
            [key]: d[key].includes(v)
                ? d[key].filter(x => x !== v)
                : [...d[key], v],
        }));

    const durationItems: { key: string; label: string }[] = [
        { key: 'upTo2', label: dict.durations.upTo2 },
        { key: '2to4', label: dict.durations['2to4'] },
        { key: '4to6', label: dict.durations['4to6'] },
        { key: 'fullDay', label: dict.durations.fullDay },
    ];
    const timeItems = [
        { key: 'morning', label: dict.times.morning },
        { key: 'afternoon', label: dict.times.afternoon },
        { key: 'evening', label: dict.times.evening },
    ];
    const cancellationItems = [
        { key: '24h', label: dict.cancellation['24h'] },
        { key: '48h', label: dict.cancellation['48h'] },
        { key: '72h', label: dict.cancellation['72h'] },
    ];
    const ratingItems = [
        { key: '3', label: '3.0+' },
        { key: '4', label: '4.0+' },
        { key: '4.5', label: '4.5+' },
    ];

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className='fixed inset-0 z-100 flex items-center justify-center p-5'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}>
                    {/* Overlay (.mback) */}
                    <div
                        className='absolute inset-0 bg-it-dark/50'
                        onClick={onClose}
                        aria-hidden='true'
                    />

                    {/* Panel (.fmodal) — flex-col; header + footer are shrink-0
                         so only the middle section div scrolls (flex-1 min-h-0). */}
                    <motion.div
                        role='dialog'
                        aria-modal='true'
                        aria-label={dict.title}
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{
                            duration: 0.22,
                            ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        className='relative flex max-h-[88vh] w-full max-w-[560px] flex-col rounded-it-lg bg-it-white'>
                        {/* Header (.mhead) — never scrolls */}
                        <div className='flex shrink-0 items-center justify-between border-b border-it-divider px-6 py-[18px]'>
                            <h2 className='m-0 font-it-display text-[19px] font-bold leading-[1.2] text-it-ink'>
                                {dict.title}
                            </h2>
                            <motion.button
                                type='button'
                                aria-label='Close'
                                onClick={onClose}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className='grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-full border-none bg-it-bg text-[15px] leading-none text-it-text-muted'>
                                ✕
                            </motion.button>
                        </div>

                        {/* Scrollable body — flex-1 + min-h-0 is required for
                             overflow-y:auto to trigger inside a flex-col parent. */}
                        <div className='it-modal-scroll min-h-0 flex-1 px-6 pb-1 pt-2'>
                            {/* Price */}
                            <Section title={dict.price}>
                                <PriceRange
                                    value={draft.price}
                                    max={priceMax}
                                    onChange={price =>
                                        setDraft(d => ({ ...d, price }))
                                    }
                                />
                                <div className='flex items-center justify-between text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                                    <span>
                                        {formatPriceFrom(
                                            draft.price[0],
                                            currency,
                                            locale
                                        )}
                                    </span>
                                    <span>
                                        {formatPriceFrom(
                                            draft.price[1],
                                            currency,
                                            locale
                                        )}
                                    </span>
                                </div>
                            </Section>

                            {/* Duration */}
                            <Section title={dict.duration}>
                                <div className='flex flex-wrap gap-2'>
                                    {durationItems.map(item => (
                                        <OptChip
                                            key={item.key}
                                            on={draft.durations.includes(
                                                item.key
                                            )}
                                            onClick={() =>
                                                toggleArray(
                                                    'durations',
                                                    item.key
                                                )
                                            }>
                                            {item.label}
                                        </OptChip>
                                    ))}
                                </div>
                            </Section>

                            {/* Time of day */}
                            <Section title={dict.timeOfDay}>
                                <div className='flex flex-wrap gap-2'>
                                    {timeItems.map(item => (
                                        <OptChip
                                            key={item.key}
                                            on={draft.times.includes(item.key)}
                                            onClick={() =>
                                                toggleArray('times', item.key)
                                            }>
                                            {item.label}
                                        </OptChip>
                                    ))}
                                </div>
                            </Section>

                            {/* Free cancellation - single-select chips */}
                            <Section title={dict.freeCancellation}>
                                <p className='-mt-2 mb-3 text-[13px] leading-[1.6] text-it-text-muted'>
                                    {dict.freeCancellationNote}{' '}
                                    {dict.cancellationLabel}
                                </p>
                                <div className='flex flex-wrap gap-2'>
                                    {cancellationItems.map(item => (
                                        <OptChip
                                            key={item.key}
                                            on={draft.cancellation === item.key}
                                            onClick={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    cancellation:
                                                        d.cancellation ===
                                                        item.key
                                                            ? null
                                                            : item.key,
                                                }))
                                            }>
                                            {item.label}
                                        </OptChip>
                                    ))}
                                </div>
                            </Section>

                            {/* Pickup available - toggle + expectation note */}
                            <Section>
                                <div className='flex items-center justify-between gap-4'>
                                    <div>
                                        <h4 className='m-0 mb-1 text-[14px] font-bold leading-[1.6] text-it-ink'>
                                            {dict.pickupAvailable}
                                        </h4>
                                        <p className='m-0 max-w-[380px] text-[13px] leading-[1.6] text-it-text-muted'>
                                            {dict.pickupNote}
                                        </p>
                                    </div>
                                    <Toggle
                                        on={draft.pickupAvailable}
                                        onChange={() =>
                                            setDraft(d => ({
                                                ...d,
                                                pickupAvailable:
                                                    !d.pickupAvailable,
                                            }))
                                        }
                                    />
                                </div>
                            </Section>

                            {/* Ratings — hidden until catalogue has reviews */}
                            {hasReviews && (
                                <Section title={dict.ratings}>
                                    <div className='flex flex-wrap gap-2'>
                                        {ratingItems.map(item => (
                                            <OptChip
                                                key={item.key}
                                                on={draft.rating === item.key}
                                                onClick={() =>
                                                    setDraft(d => ({
                                                        ...d,
                                                        rating:
                                                            d.rating ===
                                                            item.key
                                                                ? null
                                                                : item.key,
                                                    }))
                                                }>
                                                {item.label}
                                            </OptChip>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </div>

                        {/* Footer (.mfoot) — never scrolls, always visible */}
                        <div className='flex shrink-0 items-center justify-between gap-3.5 border-t border-it-divider px-6 py-3.5'>
                            <motion.button
                                type='button'
                                onClick={() =>
                                    // NOT bare `EMPTY_FILTERS`: its `price` is
                                    // the static [0, 560], while this modal
                                    // works against the DESTINATION's effective
                                    // ceiling. Below 560 the max handle
                                    // rendered off the track (pct(560) = 280%);
                                    // above it, `filtersToTourQuery` still sent
                                    // `maxPrice=560`, so "Clear all" left a
                                    // price filter applied and hid every tour
                                    // over 560. `ToursFilterBar.clearAll` has
                                    // always done this correctly.
                                    setDraft({
                                        ...EMPTY_FILTERS,
                                        price: [PRICE_MIN, priceMax],
                                    })
                                }
                                whileTap={{ scale: 0.97 }}
                                transition={springPop}
                                className='cursor-pointer border-none bg-transparent p-0 text-[13.5px] font-bold leading-[1.6] text-it-text-muted underline underline-offset-2'>
                                {dict.clearAll}
                            </motion.button>
                            <motion.button
                                type='button'
                                onClick={() => onApply(draft)}
                                whileTap={{ scale: 0.98 }}
                                transition={springPop}
                                className='cursor-pointer rounded-it-sm border-none bg-it-primary px-[26px] py-3 text-[15px] font-bold leading-[1.6] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover'>
                                {dict.applyFilters}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

