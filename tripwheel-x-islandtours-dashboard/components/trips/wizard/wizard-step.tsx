'use client';

/**
 * Step chrome (07 §5.1): the title block every step opens with, plus the
 * shared "take me to the problem" helper.
 *
 * Visual hierarchy is deliberately flat - the step title is the ONLY large
 * type on the screen, so section headers can stay at 16px and the eye always
 * knows what the page is about.
 */

import type { ReactNode } from 'react';

import { getStep, type WizardStepId } from '@/lib/trips/wizard-steps';
import { cn } from '@/lib/utils';

interface WizardStepHeaderProps {
    step: WizardStepId;
    /** Overrides the registry title (the review step retitles on publish). */
    title?: string;
    /**
     * Opt-IN only, and rarely worth it.
     *
     * Every step used to print a sentence under its title, which meant the
     * same thing was said three times before the first field: the rail label
     * ("Pricing"), the heading ("Pricing"), then "How much this tour costs and
     * how travellers are charged." The sections below carry their own copy
     * where it earns its place, so the default is now nothing.
     *
     * Review still passes one - a summary screen genuinely needs a line
     * telling you what you are looking at.
     */
    description?: ReactNode;
    /** Right-aligned slot: counters, status chips. */
    aside?: ReactNode;
}

export function WizardStepHeader({
    step,
    title,
    description,
    aside,
}: WizardStepHeaderProps) {
    const def = getStep(step);
    return (
        <header className='mb-4 flex flex-wrap items-end justify-between gap-4'>
            <div className='min-w-0'>
                {/* Semibold, and NOT tracking-tight. The base `h2` rule
                    already sets -0.02em; stacking `tracking-tight` on top took
                    it to -0.025em, and at 18px Geist that density is what read
                    as bold - the weight was 600 all along. */}
                <h2 className='text-lg font-medium text-content'>
                    {title ?? def.title}
                </h2>
                {description && (
                    <p className='mt-1 max-w-2xl text-sm text-content-muted'>
                        {description}
                    </p>
                )}
            </div>
            {aside && <div className='shrink-0'>{aside}</div>}
        </header>
    );
}

/**
 * A step's sections are one continuous ruled list on the page field - no
 * sheet, no card. The hairline each `WizardSection` draws is the only
 * separator, so there is no gap to add here.
 *
 * Inputs keep their stock `surface-raised` fill - the same soft off-white
 * they have on every other dashboard form. No wizard-local surface overrides.
 */
export function WizardStepBody({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('border-t border-line', className)}>{children}</div>
    );
}

/**
 * Scroll the first invalid control into view and focus it.
 *
 * Called by a step after its resolver rejects, once the offending section has
 * been revealed. Centring rather than top-aligning matters here: the sticky
 * footer and the sticky progress rail both eat viewport, and `block: 'start'`
 * put the field under the rail often enough to look broken.
 */
export function focusFirstInvalid(root?: HTMLElement | null): void {
    const scope = root ?? document;
    const el = scope.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([disabled])'
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // The scroll is async; focusing immediately fights it on Safari.
    window.setTimeout(() => el.focus({ preventScroll: true }), 120);
}

