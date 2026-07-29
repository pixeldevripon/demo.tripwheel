'use client';

/**
 * The progress rail (07 §5.2) - the wizard's ONLY navigation.
 *
 * It is a map, not a menu: where you are, what is behind you, what is still
 * thin. Clicking a step is allowed when `canNavigateTo` says so (everything in
 * edit mode, only what you have seen while creating).
 *
 * No separate progress bar. The rail already encodes position twice - filled
 * circles behind you, a ringed circle where you are - so a full-width bar
 * underneath was a third telling of the same thing, and the widest element on
 * the screen at that.
 *
 * Connectors are drawn as two absolute half-width hairlines inside a wrapper
 * the exact height of the circle, so `items-center` lands them on the circle's
 * vertical centre with no magic offset, and each half runs edge-to-centre
 * where the opaque circle covers it. That is what makes the line meet the
 * circle instead of floating short of it.
 *
 * The completeness state comes from `isStepComplete()`, derived from
 * the same trip fields as `lib/trips/readiness.ts` - a step can never look
 * finished here while failing its publish check on the review step. Signal
 * only; nothing on this rail blocks anything.
 */

import { Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { springPop } from '@/lib/motion';
import { useTripTranslationByLocale } from '@/hooks/trips/use-trips';
import {
    WIZARD_STEPS,
    getStepIndex,
    isStepComplete,
    type WizardStepId,
} from '@/lib/trips/wizard-steps';
import { cn } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import { useWizard } from './wizard-context';

type StepState = 'complete' | 'current' | 'incomplete' | 'locked';

/**
 * One accent, used only to mean something: teal is "done" or "here", and
 * nothing else on the rail is coloured. The current step earns a halo rather
 * than a heavier border, so it reads as lit rather than as thicker.
 */
const PILL_STYLES: Record<StepState, string> = {
    complete: 'border-primary bg-primary text-primary-content',
    current:
        'border-primary bg-primary-subtle text-primary-subtle-content ring-4 ring-primary/10',
    incomplete:
        'border-line bg-surface-raised text-content-subtle hover:border-line-strong hover:text-content-muted',
    locked: 'border-line bg-surface-raised text-content-subtle opacity-40',
};

const LABEL_STYLES: Record<StepState, string> = {
    complete: 'text-content-muted hover:text-content',
    current: 'text-content font-medium',
    incomplete: 'text-content-subtle hover:text-content-muted',
    locked: 'text-content-subtle opacity-40',
};

interface WizardProgressProps {
    trip: TripListItem | null;
}

export function WizardProgress({ trip }: WizardProgressProps) {
    const { step, visited, goTo, canNavigateTo } = useWizard();
    const reduceMotion = useReducedMotion();
    // The overview is a publish check but lives on the translation record, not
    // the tour. Cached by the description and review steps, so this is a read,
    // not a fetch.
    const { data: enTranslation } = useTripTranslationByLocale(
        trip?.id ?? '',
        'en',
    );
    const hasEnOverview = !!enTranslation?.overview?.trim();

    const activeIndex = getStepIndex(step);
    const total = WIZARD_STEPS.length;

    function stateFor(id: WizardStepId, index: number): StepState {
        if (id === step) return 'current';
        if (!canNavigateTo(id)) return 'locked';
        if (trip && isStepComplete(id, trip, hasEnOverview)) return 'complete';
        return 'incomplete';
    }

    return (
        <div>
            {/* Numbered rail - md and up. Below that it would wrap, so the dot
                row takes over.

                The CONNECTORS carry `flex-1`, not the steps. When each step
                owned an equal-width cell and centred its circle inside it, the
                first circle sat half a cell in from the left and the rail
                floated away from the content below it. Making the gaps elastic
                and the circles `shrink-0` pins step 1 flush left and step 9
                flush right, with the line running edge to edge between them.

                Labels are ABSOLUTE. In flow they made each step column as wide
                as its widest word ("Booking rules"), so the connector stopped
                at the label's edge and left a gap either side of the circle.
                Out of flow, a step is exactly as wide as its 28px circle and
                the lines meet it. `pb-6` on the list reserves their height. */}
            <ol className='hidden items-center pb-6 md:flex'>
                {WIZARD_STEPS.map((def, i) => {
                    const state = stateFor(def.id, i);
                    const reachable = state !== 'locked';
                    const isFirst = i === 0;
                    // Connector colour follows what is BEHIND you, so the rail
                    // reads as a filled track up to the current step.
                    const connectorDone = i <= activeIndex;

                    return (
                        <li
                            key={def.id}
                            className={cn(
                                'flex items-center',
                                !isFirst && 'min-w-0 flex-1'
                            )}>
                            {!isFirst && (
                                // The one memorable moment: the track SWEEPS
                                // in behind you rather than snapping colour.
                                // A dormant hairline underneath means the rail
                                // never has a hole in it mid-animation.
                                <span
                                    aria-hidden
                                    className='relative h-px flex-1 bg-line'>
                                    <motion.span
                                        className='absolute inset-y-0 left-0 bg-primary/50'
                                        initial={false}
                                        animate={{
                                            width: connectorDone
                                                ? '100%'
                                                : '0%',
                                        }}
                                        transition={
                                            reduceMotion
                                                ? { duration: 0 }
                                                : {
                                                      duration: 0.4,
                                                      ease: [0.4, 0, 0.2, 1],
                                                  }
                                        }
                                    />
                                </span>
                            )}

                            <div className='relative flex size-7 shrink-0 items-center justify-center'>
                                <button
                                    type='button'
                                    onClick={() => reachable && goTo(def.id)}
                                    disabled={!reachable}
                                    aria-current={
                                        state === 'current' ? 'step' : undefined
                                    }
                                    aria-label={`Step ${i + 1}: ${def.label}`}
                                    className={cn(
                                        'flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums outline-none',
                                        // Colour-only hover, per the house
                                        // interaction language: no lift, no
                                        // scale-up, ever.
                                        'transition-[color,background-color,border-color,box-shadow] duration-normal',
                                        'focus-visible:ring-4 focus-visible:ring-primary/25',
                                        reachable
                                            ? 'cursor-pointer'
                                            : 'cursor-not-allowed',
                                        PILL_STYLES[state]
                                    )}>
                                    <AnimatePresence
                                        mode='wait'
                                        initial={false}>
                                        {state === 'complete' ? (
                                            <motion.span
                                                key='check'
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                transition={
                                                    reduceMotion
                                                        ? { duration: 0 }
                                                        : springPop
                                                }
                                                className='flex'>
                                                {/* Tick01 + a heavier stroke:
                                                    the default weight reads
                                                    as a hairline scratch at
                                                    14px inside a filled
                                                    28px circle. */}
                                                <HugeiconsIcon
                                                    icon={Tick01Icon}
                                                    strokeWidth={3}
                                                    className='size-3.5'
                                                />
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key='num'
                                                initial={{ scale: 0.6 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0.6 }}
                                                transition={
                                                    reduceMotion
                                                        ? { duration: 0 }
                                                        : springPop
                                                }>
                                                {i + 1}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </button>

                                <button
                                    type='button'
                                    tabIndex={-1}
                                    onClick={() => reachable && goTo(def.id)}
                                    disabled={!reachable}
                                    className={cn(
                                        'absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-2xs leading-tight whitespace-nowrap',
                                        reachable
                                            ? 'cursor-pointer'
                                            : 'cursor-not-allowed',
                                        LABEL_STYLES[state]
                                    )}>
                                    {def.label}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {/* Compact rail - dots plus the current label, so it can never
                wrap and still says where you are. */}
            <div className='flex items-center gap-2 md:hidden'>
                <div className='flex items-center gap-1.5'>
                    {WIZARD_STEPS.map((def, i) => {
                        const state = stateFor(def.id, i);
                        return (
                            <button
                                key={def.id}
                                type='button'
                                aria-label={`Step ${i + 1}: ${def.label}`}
                                aria-current={
                                    def.id === step ? 'step' : undefined
                                }
                                disabled={state === 'locked'}
                                onClick={() =>
                                    state !== 'locked' && goTo(def.id)
                                }
                                className={cn(
                                    'size-2 shrink-0 rounded-full transition-colors duration-fast',
                                    state === 'current'
                                        ? 'bg-primary ring-2 ring-primary/30'
                                        : state === 'complete'
                                          ? 'bg-primary/50'
                                          : 'bg-line',
                                    state === 'locked' && 'opacity-40'
                                )}
                            />
                        );
                    })}
                </div>
                <p className='ml-auto shrink-0 text-2xs font-medium tabular-nums text-content-muted'>
                    Step {activeIndex + 1} of {total} ·{' '}
                    {WIZARD_STEPS[activeIndex].label}
                </p>
            </div>
        </div>
    );
}

