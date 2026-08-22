'use client';

/**
 * Shared building blocks for the read-only row-click detail sheets (bookings,
 * payments, customers, reviews...). One visual language for every list's
 * quick view: micro-label sections, label/value rows, the boxed money
 * summary, and the prev/next pager that walks the current page's rows.
 * Extracted from the booking details sheet (Phase 24) when the other lists
 * gained sheets of their own.
 */

import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';

/** Row-walking props every detail sheet accepts (wired by its table). */
export interface SheetPagerProps {
    /** Navigate to the previous row on the current page; omit to disable. */
    onPrev?: () => void;
    /** Navigate to the next row on the current page; omit to disable. */
    onNext?: () => void;
    /** 1-based position within the current page, for the "n of N" label. */
    position?: { index: number; count: number };
}

/** "n of N" + prev/next arrows, rendered on the right of a sheet header. */
export function SheetPager({ onPrev, onNext, position }: SheetPagerProps) {
    if (!onPrev && !onNext) return null;
    return (
        <div className='flex shrink-0 items-center gap-1'>
            {position && (
                <span className='mr-1 text-xs tabular-nums text-content-subtle'>
                    {position.index} of {position.count}
                </span>
            )}
            <Button
                variant='outline'
                size='icon-sm'
                aria-label='Previous row'
                onClick={onPrev}
                disabled={!onPrev}>
                <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button
                variant='outline'
                size='icon-sm'
                aria-label='Next row'
                onClick={onNext}
                disabled={!onNext}>
                <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
        </div>
    );
}

/** Micro-label section wrapper - mirrors the sidebar group-label style. */
export function Section({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className='py-4 first:pt-2'>
            <p className='m-0 mb-2 text-2xs font-medium uppercase tracking-caps text-content-muted'>
                {label}
            </p>
            <div className='space-y-0.5'>{children}</div>
        </div>
    );
}

export function Row({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className='flex items-start justify-between gap-4 py-1'>
            <span className='text-xs text-content-muted shrink-0'>{label}</span>
            <span className='text-sm text-right min-w-0 break-words'>
                {value}
            </span>
        </div>
    );
}

/** One line of the boxed money summary. */
export function MoneyRow({
    label,
    value,
    strong,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className='flex items-center justify-between gap-4 px-3 py-2'>
            <span
                className={
                    strong
                        ? 'text-sm font-medium'
                        : 'text-xs text-content-muted'
                }>
                {label}
            </span>
            <span
                className={`tabular-nums ${strong ? 'text-sm font-medium' : 'text-sm'}`}>
                {value}
            </span>
        </div>
    );
}

