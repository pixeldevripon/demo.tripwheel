'use client';

/**
 * CollapsibleCard - THE collapsible container (user spec 2026-07-17): every
 * collapsible surface (Translation Console workspace cards, FAQ items,
 * repeatable-list rows, …) shares this one component so open/close feels
 * identical everywhere.
 *
 * Engineering notes, earned the hard way:
 * - The header is a `role="button"` div, NOT a <button>: the actions slot
 *   renders real <Button>s and nested buttons are invalid HTML - browsers
 *   fracture the DOM, which breaks the hit area.
 * - No shadcn <Card> wrapper: its `data-[size]` variant paddings out-rank a
 *   plain `py-0` through tailwind-merge and leave dead, unclickable padding.
 *   A plain div with the card tokens has nothing to fight.
 * - Content stays MOUNTED and animates height via framer-motion. Unmounting
 *   through AnimatePresence made open/close stutter: mounting a heavy form
 *   mid-animation janks, and `field-sizing-content` textareas re-measure on
 *   every height frame. Closed content is `inert` + aria-hidden.
 */

import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
    /** Header main line (title text or richer node). */
    title: ReactNode;
    /** Chips/meta rendered under the title. */
    meta?: ReactNode;
    /** Leading visual (IconTile). */
    leading?: ReactNode;
    /** Right-side controls (delete, …) - clicks here never toggle. */
    actions?: ReactNode;
    defaultOpen?: boolean;
    /**
     * Controlled open state. Omit for the uncontrolled default. The wizard
     * drives this so a step can force a card open when validation fails inside
     * it, and so open/closed survives step navigation (07 §5.3).
     */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Danger border - the card holds a field that failed validation. */
    invalid?: boolean;
    /** Compact paddings (dense lists like FAQ items). */
    compact?: boolean;
    /**
     * Drop the card chrome entirely - no border box, no rounding, no shadow,
     * no ring, no horizontal padding. Rows separate with a single hairline
     * instead. Opt-in: the translation console and the FAQ manager want the
     * card look; the creation wizard's lists do not, and stacking boxed rows
     * inside an already-bounded section read as cards within cards.
     */
    flat?: boolean;
    className?: string;
    children: ReactNode;
}

export function CollapsibleCard({
    title,
    meta,
    leading,
    actions,
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    invalid = false,
    compact = false,
    flat = false,
    className,
    children,
}: CollapsibleCardProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const reduceMotion = useReducedMotion();

    function toggle() {
        const next = !open;
        if (controlledOpen === undefined) setUncontrolledOpen(next);
        onOpenChange?.(next);
    }

    function onHeaderKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.target !== e.currentTarget) return; // inner controls keep their keys
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    }

    return (
        <div
            className={cn(
                'overflow-hidden text-sm transition-colors duration-fast',
                flat
                    ? 'border-b last:border-b-0'
                    : 'rounded-lg border bg-card shadow-xs ring-1',
                invalid
                    ? flat
                        ? 'border-danger-border'
                        : 'border-danger-border ring-danger-border/40'
                    : flat
                      ? 'border-line'
                      : 'border-line ring-foreground/5',
                className
            )}>
            <div
                role='button'
                tabIndex={0}
                aria-expanded={open}
                onClick={toggle}
                onKeyDown={onHeaderKeyDown}
                className={cn(
                    'flex w-full cursor-pointer items-center gap-3 text-left outline-none transition-colors duration-fast select-none',
                    'hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60',
                    flat ? 'py-3' : compact ? 'px-4 py-3' : 'px-6 py-4'
                )}>
                {leading && <span className='shrink-0'>{leading}</span>}
                <div className='min-w-0 flex-1'>
                    {/* Flat rows take the compact type scale. `flat` sets
                        `compact={false}`, which was landing these on the 16px
                        card-title size - a list row was rendering larger than
                        the section heading above it. */}
                    {/* Open takes the primary colour, same rule as
                        `WizardSection`: in a stack of rows the expanded one
                        otherwise reads exactly like the collapsed ones around
                        it. Colour only - the weight stays put so the row does
                        not reflow as it opens. */}
                    <div
                        className={cn(
                            'transition-colors duration-fast',
                            open ? 'text-primary' : 'text-content',
                            flat
                                ? 'text-sm leading-snug font-normal'
                                : compact
                                  ? 'text-sm leading-snug font-medium'
                                  : 'text-base font-medium'
                        )}>
                        {title}
                    </div>
                    {meta && <div className='mt-1'>{meta}</div>}
                </div>
                {actions && (
                    <span
                        className='flex shrink-0 items-center gap-1.5'
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}>
                        {actions}
                    </span>
                )}
                <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className={cn(
                        'size-4 shrink-0 text-content-subtle transition-transform duration-normal',
                        open && 'rotate-180'
                    )}
                />
            </div>

            <motion.div
                initial={false}
                animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                transition={
                    reduceMotion
                        ? { duration: 0 }
                        : {
                              height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                              opacity: {
                                  duration: 0.22,
                                  ease: [0.4, 0, 0.2, 1],
                              },
                          }
                }
                inert={!open}
                aria-hidden={!open}
                className='overflow-hidden'>
                <div
                    className={cn(
                        flat
                            ? 'pb-6'
                            : compact
                              ? 'border-t border-line px-4 py-4'
                              : 'border-t border-line px-6 py-6'
                    )}>
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

