'use client';

/**
 * The one action bar (07 §5.1, §5.4).
 *
 * Every step delegates its primary action here, which is what lets a step body
 * be nothing but fields. Two shapes:
 *
 *   create  [ Back ]            [ Skip ]  [ Save and continue ]
 *   edit    [ Back to review ]            [ Save changes ]
 *
 * Refusal is physical, not textual: when the step's `submit` resolves false
 * the button shakes once. The step is responsible for opening the offending
 * section and focusing the field - see `focusFirstInvalid` in wizard-step.
 *
 * Elevation appears only once there is content scrolled underneath, so a short
 * step does not get a floating bar hovering over whitespace.
 */

import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    AnimatePresence,
    motion,
    useAnimationControls,
    useReducedMotion,
} from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { springPop, swapFade } from '@/lib/motion';
import {
    getPrevStep,
    getStep,
    REVIEW_STEP,
    type WizardStepId,
} from '@/lib/trips/wizard-steps';
import { cn } from '@/lib/utils';
import { useWizard } from './wizard-context';

/** Steps an operator may pass without answering anything (07 §4.2). */
function canSkip(stepId: WizardStepId): boolean {
    if (getStep(stepId).blocking) return false;
    // Reach is walk-through but NOT skippable: an operator has to see the
    // commission tier their tour will run on before it can go live.
    if (stepId === 'reach') return false;
    return stepId !== REVIEW_STEP;
}

export function WizardFooter() {
    const {
        mode,
        step,
        tripId,
        goBack,
        goTo,
        goNext,
        goNextAfterSave,
        isSaving,
        isDirty,
        commitCurrentStep,
    } = useWizard();

    const reduceMotion = useReducedMotion();
    const controls = useAnimationControls();
    const [elevated, setElevated] = useState(false);
    // Drives the persistent status line. "All changes saved" is a lie before
    // anything has been saved, so the line stays absent until the first one.
    const [savedOnce, setSavedOnce] = useState(false);

    useEffect(() => {
        const onScroll = () => setElevated(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // The review step draws its own lifecycle CTA (Submit / Approve /
    // Publish), so the generic bar would only add a second primary button.
    if (step === REVIEW_STEP) return null;

    const isEdit = mode === 'edit';
    const hasPrev = !!getPrevStep(step);
    // No draft yet: this click mints the row, so say so. Also keeps the
    // "Create Trip" label the e2e specs assert on.
    const isCreatingDraft = !tripId;

    const primaryLabel = isSaving
        ? isCreatingDraft
            ? 'Creating...'
            : 'Saving...'
        : isCreatingDraft
          ? 'Create Trip'
          : isEdit
            ? 'Save changes'
            : 'Save and continue';

    /**
     * Where saving leaves you.
     *
     * Creating: forward, because the journey IS the sequence.
     *
     * Editing: nowhere. Saving used to jump back to Review unconditionally,
     * on the assumption that every edit is a round trip from the hub. It is
     * not - an operator who clicked Pricing on the rail, or opened a deep
     * link, or is working through three sections in a row, got yanked out of
     * the step they were still using. Saving is not leaving, and the same
     * button should not sometimes navigate and sometimes not.
     *
     * The confirmation the jump used to provide is already covered by the
     * status line beside the button, which settles to "All changes saved".
     * Leaving is an explicit choice - the rail, or "Back to review".
     */
    function advance() {
        // `goNextAfterSave`, not `goNext`: the commit has resolved but the
        // step's dirty flag has not caught up yet, and the plain path would
        // stop on the unsaved-changes dialog.
        if (!isEdit) goNextAfterSave();
    }

    async function handlePrimary() {
        const ok = await commitCurrentStep();
        if (!ok) {
            // Refusal is physical, not textual. The step owns opening the
            // offending section and focusing the field.
            if (!reduceMotion) {
                controls.start({
                    x: [0, -4, 4, -3, 3, 0],
                    transition: { duration: 0.3 },
                });
            }
            return;
        }

        // No confirmation frame on the button. The spinner already showed the
        // work happening, and the status line beside it settles to "All
        // changes saved" - a label that morphs, pops a tick and then morphs
        // back drew the eye to the button twice for one event.
        setSavedOnce(true);
        advance();
    }

    return (
        <div
            className={cn(
                'sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-shell-content/95 px-4 py-3 backdrop-blur-sm',
                'transition-shadow duration-normal',
                'pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3',
                elevated && 'shadow-md',
            )}>
            <div className='flex w-full max-w-5xl items-center gap-3'>
                {isEdit ? (
                    <Button
                        type='button'
                        variant='ghost'
                        onClick={() => goTo(REVIEW_STEP)}
                        disabled={isSaving}>
                        <HugeiconsIcon
                            icon={ArrowLeft01Icon}
                            className='size-3.5'
                        />
                        Back to review
                    </Button>
                ) : hasPrev ? (
                    <Button
                        type='button'
                        variant='ghost'
                        onClick={goBack}
                        disabled={isSaving}>
                        <HugeiconsIcon
                            icon={ArrowLeft01Icon}
                            className='size-3.5'
                        />
                        Back
                    </Button>
                ) : (
                    <span />
                )}

                <StepStatus isDirty={isDirty} savedOnce={savedOnce} />

                <div className='ml-auto flex items-center gap-2'>
                    {!isEdit && canSkip(step) && (
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={goNext}
                            disabled={isSaving}
                            className='text-content-muted'>
                            Skip for now
                        </Button>
                    )}

                    <motion.div
                        animate={controls}
                        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                        transition={springPop}>
                        <Button
                            type='button'
                            onClick={handlePrimary}
                            disabled={isSaving}>
                            {isSaving && (
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className='size-3.5 animate-spin'
                                />
                            )}
                            {primaryLabel}
                            {!isSaving && !(isEdit && !isCreatingDraft) && (
                                <HugeiconsIcon
                                    icon={ArrowRight01Icon}
                                    className='size-3.5'
                                />
                            )}
                        </Button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

/**
 * The quiet answer to "is my work safe?".
 *
 * This is what replaced the per-step success toasts. A toast answered the
 * question once, in the opposite corner, then deleted the answer. A status
 * line answers it continuously and costs nothing to ignore - and it is
 * `aria-live`, so assistive tech gets a state change rather than an
 * interruption.
 */
function StepStatus({
    isDirty,
    savedOnce,
}: {
    isDirty: boolean;
    savedOnce: boolean;
}) {
    const reduceMotion = useReducedMotion();
    const label = isDirty
        ? 'Unsaved changes'
        : savedOnce
          ? 'All changes saved'
          : null;

    return (
        <span
            aria-live='polite'
            className='ml-3 hidden min-w-0 sm:block'>
            <AnimatePresence mode='wait' initial={false}>
                {label && (
                    <motion.span
                        key={label}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reduceMotion ? { duration: 0 } : swapFade}
                        className={cn(
                            'flex items-center gap-1.5 text-xs',
                            isDirty ? 'text-content-muted' : 'text-content-subtle',
                        )}>
                        <span
                            aria-hidden
                            className={cn(
                                'size-1.5 rounded-full',
                                isDirty ? 'bg-warning-solid' : 'bg-success-solid',
                            )}
                        />
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}
