'use client';

/**
 * How a wizard step hands its save to the sticky footer (07 §5.1).
 *
 * The footer is the only place with a primary button, so each step declares
 * what Continue should do:
 *
 *   const submit = useCallback(async () => {
 *     const ok = await handleSubmit(onValid, onInvalid)();
 *     return ok !== false;
 *   }, [...]);
 *   useStepCommit('rules', { submit, isPending, isDirty });
 *
 * `submit` MUST be memoised - it is a dependency of the registration effect.
 * Steps that persist through child mutations as the operator works (media,
 * the content lists) simply omit it and Continue advances.
 */

import { useEffect, useId } from 'react';

import type { WizardStepId } from '@/lib/trips/wizard-steps';
import { useWizard, type StepCommit } from './wizard-context';

export function useStepCommit(step: WizardStepId, commit: StepCommit): void {
    const { registerCommit } = useWizard();
    const { submit, isPending, isDirty } = commit;
    // A step may host several independent forms (content owns both the English
    // copy and the advanced trip settings), so registration is per instance
    // rather than per step.
    const key = useId();

    useEffect(
        () => registerCommit(step, key, { submit, isPending, isDirty }),
        [registerCommit, step, key, submit, isPending, isDirty],
    );
}
