'use client';

/**
 * The step's save failure, shown in place (07 §5.4).
 *
 * Thin wrapper: this owns the `useWizard()` wiring, `SaveError` owns everything
 * visual. They were one file until Settings > Scripts needed the same treatment
 * for the same reason - the server's rejection is the most useful thing the form
 * produces, and a toast is where it goes to be missed.
 */

import { SaveError } from '@/components/common/save-error';

import { useWizard } from './wizard-context';

export function WizardStepError() {
    const { stepError, setStepError } = useWizard();

    return (
        <SaveError
            message={stepError}
            title='This step could not be saved'
            onDismiss={() => setStepError(null)}
        />
    );
}
