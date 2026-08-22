'use client';

/**
 * A group of fields inside a step (07 §5.3).
 *
 * NOT a card. The first pass reused `CollapsibleCard`, and stacking six of
 * those inside a step gave every group a border, a ring, a shadow and 24px of
 * padding - so a step read as a settings page with six panels rather than one
 * continuous form. Sections are now hairline-separated rows in a single flat
 * list: one border between neighbours, no rounding, no elevation.
 *
 * `CollapsibleCard` is deliberately untouched - the translation console and
 * the FAQ manager want the card look, and this does not.
 *
 * The behavioural contract is unchanged and still matters:
 * - the first section of a step opens by default;
 * - a section holding a validation error force-opens and marks itself;
 * - open/closed is stored per `step:section`, so navigating away and back
 *   restores the exact shape;
 * - content stays MOUNTED and animates height. Unmounting made open/close
 *   stutter and would discard half-typed values; closed content is `inert`.
 */

import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, type KeyboardEvent, type ReactNode } from 'react';

import { springPop, swapFade } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useWizard } from './wizard-context';

interface WizardSectionProps {
    /** Stable within the step; the wizard scopes it, so ids need not be global. */
    id: string;
    title: string;
    /** Only when the title genuinely is not enough - most sections skip this. */
    description?: string;
    /**
     * Right-aligned answer chip: collapsed must never mean invisible.
     *
     * Treat this as REQUIRED in spirit. A step is a stack of eight or nine
     * closed rows, and a row without a summary is a drawer that cannot answer
     * "do I need to open this?" - so the operator has to open all of them to
     * find out, which is the exact cost collapsing was supposed to remove.
     */
    summary?: ReactNode;
    defaultOpen?: boolean;
    /** Something inside failed validation: force open and mark it. */
    invalid?: boolean;
    /**
     * Genuinely optional section - rendered quieter than its neighbours.
     *
     * Without this every row carries identical weight, so "Advanced and
     * integrations" (whose own description says "safe to ignore") shouts as
     * loudly as "What's included", which feeds a publish gate.
     */
    muted?: boolean;
    children: ReactNode;
}

export function WizardSection({
    id,
    title,
    description,
    summary,
    defaultOpen = false,
    invalid = false,
    muted = false,
    children,
}: WizardSectionProps) {
    const { step, isSectionOpen, setSectionOpen, revealSection } = useWizard();
    const reduceMotion = useReducedMotion();
    const key = `${step}:${id}`;
    const open = isSectionOpen(key, defaultOpen);

    // An error inside a closed section is an error the operator cannot find.
    useEffect(() => {
        if (invalid) revealSection(key);
    }, [invalid, key, revealSection]);

    function toggle() {
        setSectionOpen(key, !open);
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.target !== e.currentTarget) return; // inner controls keep their keys
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    }

    return (
        // `data-wizard-section` is the stable handle for tests and deep links:
        // consolidating tabs into steps means two sections can hold a field
        // with the same name, so anything targeting a field scopes by section.
        <div
            data-wizard-section={id}
            className={cn(
                'border-b border-line last:border-b-0',
                invalid && 'border-danger-border'
            )}>
            {/* role=button rather than <button>: the summary slot can contain
                real controls, and nested buttons fracture the DOM.

                The whole row is the hit target and it says so - a tint on
                hover, a held tint while open. Colour only: the house rule
                forbids hover lifts and scale-ups outright. */}
            <div
                role='button'
                tabIndex={0}
                aria-expanded={open}
                onClick={toggle}
                onKeyDown={onKeyDown}
                className={cn(
                    // py-4, not py-3: a collapsed step is a list of four or
                    // five one-line rows, and at 12px they packed together
                    // tightly enough to read as a table rather than as
                    // separate things you can open.
                    'group -mx-3 flex cursor-pointer items-center gap-3 rounded-md px-3 py-4 text-left outline-none select-none',
                    'transition-colors duration-fast',
                    'hover:bg-surface-sunken/50 focus-visible:bg-surface-sunken/50',
                    open && 'bg-surface-sunken/30'
                )}>
                {/* Chevron on the RIGHT: a leading chevron pushed every title
                    in by 28px, so the section headers no longer lined up with
                    the step heading or with the fields inside them. */}
                {/* One weight at all times. It used to shift weight on open,
                    so the heading got heavier as you clicked it and the row
                    reflowed a hair. The chevron and the held tint already say
                    "open". */}
                {/* An OPEN section takes the primary colour. Nine identical
                    titles in a column gave the open one no more presence than
                    the eight closed ones, so on a long step you lost track of
                    which drawer you were inside. Colour only - the weight
                    stays put, because shifting it on open reflows the row. */}
                <span
                    className={cn(
                        'text-sm transition-colors duration-fast',
                        invalid
                            ? 'font-medium text-danger-fg'
                            : open
                              ? 'font-medium text-primary'
                              : muted
                                ? 'font-normal text-content-muted'
                                : 'font-medium text-content'
                    )}>
                    {title}
                </span>

                {/* The answer chip hands over to the open panel rather than
                    vanishing - it is the same information changing form. */}
                <AnimatePresence initial={false} mode='wait'>
                    {summary && !open && (
                        <motion.span
                            key='summary'
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={
                                reduceMotion ? { duration: 0 } : swapFade
                            }
                            className='ml-auto hidden truncate text-xs tabular-nums text-content-muted sm:block'>
                            {summary}
                        </motion.span>
                    )}
                </AnimatePresence>

                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={reduceMotion ? { duration: 0 } : springPop}
                    className={cn(
                        'flex shrink-0',
                        summary && !open ? 'ml-3' : 'ml-auto'
                    )}>
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className={cn(
                            'size-4 transition-colors duration-fast',
                            open
                                ? 'text-primary'
                                : 'text-content-subtle group-hover:text-content-muted'
                        )}
                    />
                </motion.span>
            </div>

            <motion.div
                initial={false}
                animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                transition={
                    reduceMotion
                        ? { duration: 0 }
                        : {
                              height: {
                                  duration: 0.28,
                                  ease: [0.4, 0, 0.2, 1],
                              },
                              opacity: { duration: 0.18 },
                          }
                }
                inert={!open}
                aria-hidden={!open}
                className='overflow-hidden'>
                {/* No indent: with the chevron moved right, the title starts
                    at x=0 and the fields line up under it. */}
                <div className='pb-6'>
                    {description && (
                        <p className='mb-4 text-xs text-content-muted'>
                            {description}
                        </p>
                    )}
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

