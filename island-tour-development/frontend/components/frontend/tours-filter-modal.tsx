'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { PRICE_MAX, PRICE_MIN } from '@/lib/tours/filters';

/* ── Types ─────────────────────────────────────────────────────────── */

export type ToursFilterModalDict = {
    title: string;
    price: string;
    duration: string;
    durations: { upTo2: string; '2to4': string; '4to6': string; fullDay: string };
    timeOfDay: string;
    times: { morning: string; afternoon: string; evening: string };
    freeCancellation: string;
    freeCancellationNote: string;
    cancellationLabel: string;
    cancellation: { '24h': string; '48h': string; '72h': string };
    pickupAvailable: string;
    ratings: string;
    ratingsNote: string;
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
    priceMax: number = PRICE_MAX,
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

/* ── Control atoms ─────────────────────────────────────────────────── */

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
    return (
        <button
            type='button'
            role='checkbox'
            aria-checked={checked}
            onClick={onChange}
            className='flex cursor-pointer items-center gap-4 border-none bg-transparent p-0 text-left'>
            <span
                className={`grid size-5 shrink-0 place-items-center rounded-[3px] border transition-colors ${
                    checked ? 'border-it-primary bg-it-primary' : 'border-it-text-muted bg-it-white'
                }`}>
                {checked && (
                    <Image src='/icons/filters/check-white.svg' alt='' width={16} height={16} className='size-4' />
                )}
            </span>
            <span
                className={`text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                    checked ? 'text-it-heading' : 'text-it-text-muted'
                }`}>
                {label}
            </span>
        </button>
    );
}

function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: React.ReactNode }) {
    return (
        <button
            type='button'
            role='radio'
            aria-checked={checked}
            onClick={onChange}
            className='flex cursor-pointer items-center gap-4 border-none bg-transparent p-0 text-left'>
            <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${
                    checked ? 'border-it-primary' : 'border-it-text-muted'
                }`}>
                {checked && <span className='size-2.5 rounded-full bg-it-primary' />}
            </span>
            <span className='flex items-center gap-1.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                {label}
            </span>
        </button>
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
    return (
        <button
            type='button'
            role='switch'
            aria-checked={on}
            onClick={onChange}
            className={`relative h-6 w-[47px] shrink-0 cursor-pointer rounded-it-full border-none p-0 transition-colors ${
                on ? 'bg-it-primary' : 'bg-[#d9d9d9]'
            }`}>
            <span
                className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-it-white transition-all ${
                    on ? 'left-[25px]' : 'left-0.5'
                }`}
            />
        </button>
    );
}

function Stars({ rating }: { rating: number }) {
    return (
        <span className='flex items-center gap-1.5'>
            {[0, 1, 2, 3, 4].map((i) => {
                const full = i + 1 <= rating;
                const half = !full && i + 0.5 <= rating;
                const src = full
                    ? '/icons/star-listings.svg'
                    : half
                      ? '/icons/star-half.svg'
                      : '/icons/star-empty.svg';
                return <Image key={i} src={src} alt='' width={16} height={16} className='size-4' />;
            })}
        </span>
    );
}

export function PriceRange({ value, onChange, max = PRICE_MAX }: { value: [number, number]; onChange: (v: [number, number]) => void; max?: number }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<null | 0 | 1>(null);
    const span = Math.max(1, max - PRICE_MIN);
    const pct = (v: number) => ((v - PRICE_MIN) / span) * 100;

    useEffect(() => {
        if (drag === null) return;
        const move = (e: PointerEvent) => {
            const track = trackRef.current;
            if (!track) return;
            const rect = track.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
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
        <div ref={trackRef} className='relative flex h-4 items-center'>
            <span className='absolute inset-x-0 h-1.5 rounded-it-full bg-it-border' />
            <span
                className='absolute h-1.5 rounded-it-full bg-it-heading'
                style={{ left: `${pct(value[0])}%`, right: `${100 - pct(value[1])}%` }}
            />
            {([0, 1] as const).map((i) => (
                <button
                    key={i}
                    type='button'
                    aria-label={i === 0 ? 'Minimum price' : 'Maximum price'}
                    onPointerDown={() => setDrag(i)}
                    style={{ left: `${pct(value[i])}%` }}
                    className='absolute size-4 -translate-x-1/2 cursor-grab touch-none rounded-full border border-it-border bg-it-white shadow-it-sm active:cursor-grabbing'
                />
            ))}
        </div>
    );
}

/** Section wrapper - title + content, with the Figma bottom divider. */
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className='flex flex-col gap-4 border-b border-it-heading/10 py-8'>
            {title && (
                <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {title}
                </h3>
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
}

export function ToursFilterModal({
    open,
    onClose,
    dict,
    value,
    onApply,
    hasReviews = false,
    priceMax = PRICE_MAX,
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
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const toggleArray = (key: 'durations' | 'times', v: string) =>
        setDraft((d) => ({
            ...d,
            [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v],
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
        { key: '3', label: '3.0+', stars: 3 },
        { key: '4', label: '4.0+', stars: 4 },
        { key: '4.5', label: '4.5+', stars: 4.5 },
    ];

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className='fixed inset-0 z-100 flex items-center justify-center p-4'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}>
                    {/* Overlay */}
                    <div
                        className='absolute inset-0 bg-it-heading/40'
                        onClick={onClose}
                        aria-hidden='true'
                    />

                    {/* Panel */}
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
                        className='relative flex max-h-[90vh] w-full max-w-[752px] flex-col overflow-y-auto rounded-it-lg bg-it-white p-8'>
                        {/* Header */}
                        <div className='flex items-center justify-between border-b border-it-heading/10 pb-6'>
                            <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                {dict.title}
                            </h2>
                            <button
                                type='button'
                                aria-label='Close'
                                onClick={onClose}
                                className='inline-flex cursor-pointer border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/close-circle.svg'
                                    alt=''
                                    width={32}
                                    height={32}
                                    className='size-8'
                                />
                            </button>
                        </div>

                        {/* Price */}
                        <Section title={dict.price}>
                            <PriceRange
                                value={draft.price}
                                max={priceMax}
                                onChange={price =>
                                    setDraft(d => ({ ...d, price }))
                                }
                            />
                            <div className='flex items-center justify-between text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                <span>${draft.price[0]}</span>
                                <span>${draft.price[1]}</span>
                            </div>
                        </Section>

                        {/* Duration */}
                        <Section title={dict.duration}>
                            <div className='grid grid-cols-1 gap-x-12 gap-y-2.5 sm:grid-cols-2'>
                                {durationItems.map(item => (
                                    <Checkbox
                                        key={item.key}
                                        label={item.label}
                                        checked={draft.durations.includes(
                                            item.key
                                        )}
                                        onChange={() =>
                                            toggleArray('durations', item.key)
                                        }
                                    />
                                ))}
                            </div>
                        </Section>

                        {/* Time of day */}
                        <Section title={dict.timeOfDay}>
                            <div className='grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3'>
                                {timeItems.map(item => (
                                    <Checkbox
                                        key={item.key}
                                        label={item.label}
                                        checked={draft.times.includes(item.key)}
                                        onChange={() =>
                                            toggleArray('times', item.key)
                                        }
                                    />
                                ))}
                            </div>
                        </Section>

                        {/* Free cancellation */}
                        <Section>
                            <div className='flex flex-col'>
                                <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {dict.freeCancellation}
                                </h3>
                                <p className='m-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {dict.freeCancellationNote} { " "}
                                    {dict.cancellationLabel}
                                </p>
                            </div>
                            <div className='grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3'>
                                {cancellationItems.map(item => (
                                    <Radio
                                        key={item.key}
                                        label={item.label}
                                        checked={
                                            draft.cancellation === item.key
                                        }
                                        onChange={() =>
                                            setDraft(d => ({
                                                ...d,
                                                cancellation:
                                                    d.cancellation === item.key
                                                        ? null
                                                        : item.key,
                                            }))
                                        }
                                    />
                                ))}
                            </div>
                        </Section>

                        {/* Pickup available */}
                        <Section>
                            <div className='flex items-center justify-between'>
                                <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {dict.pickupAvailable}
                                </h3>
                                <Toggle
                                    on={draft.pickupAvailable}
                                    onChange={() =>
                                        setDraft(d => ({
                                            ...d,
                                            pickupAvailable: !d.pickupAvailable,
                                        }))
                                    }
                                />
                            </div>
                        </Section>

                        {/* Ratings - hidden until tours in this catalogue have reviews */}
                        {hasReviews && (
                            <Section title={dict.ratings}>
                                <div className='grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-3'>
                                    {ratingItems.map(item => (
                                        <Radio
                                            key={item.key}
                                            checked={draft.rating === item.key}
                                            onChange={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    rating:
                                                        d.rating === item.key
                                                            ? null
                                                            : item.key,
                                                }))
                                            }
                                            label={
                                                <>
                                                    <Stars
                                                        rating={item.stars}
                                                    />
                                                    <span className='ml-1.5'>
                                                        {item.label}
                                                    </span>
                                                </>
                                            }
                                        />
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Footer */}
                        <div className='flex items-center justify-between pt-6'>
                            <button
                                type='button'
                                onClick={() => setDraft(EMPTY_FILTERS)}
                                className='cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline underline-offset-2'>
                                {dict.clearAll}
                            </button>
                            <button
                                type='button'
                                onClick={() => onApply(draft)}
                                className='inline-flex h-12 cursor-pointer items-center justify-center rounded-it-full border-none bg-it-primary px-8 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover'>
                                {dict.applyFilters}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

