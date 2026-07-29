'use client';

/**
 * Step dispatcher.
 *
 * One switch, so the shell never imports a step directly and the registry in
 * `lib/trips/wizard-steps.ts` stays the only place order lives.
 *
 * MIGRATION STATE: steps still carrying their old tab component are marked
 * `LEGACY` below. Those render exactly as they do today (including their own
 * Save button), so nothing regresses while the split lands step by step - the
 * footer simply advances instead of driving a save, because a legacy step
 * registers no commit. Each task in 07 §11 removes one marker.
 */

import type { TripListItem } from '@/types/trip';
import type { WizardStepId } from '@/lib/trips/wizard-steps';

import { StepBasics } from './steps/step-basics';
import { StepContent } from './steps/step-content';
import { StepLocation } from './steps/step-location';
import { StepMedia } from './steps/step-media';
import { StepPricing } from './steps/step-pricing';
import { StepReach } from './steps/step-reach';
import { StepReview } from './steps/step-review';
import { StepRules } from './steps/step-rules';
import { StepSchedule } from './steps/step-schedule';

interface WizardStepPanelProps {
    step: WizardStepId;
    trip: TripListItem | null;
}

export function WizardStepPanel({ step, trip }: WizardStepPanelProps) {
    if (step === 'basics') return <StepBasics trip={trip} />;

    // Every other step edits an existing draft. Step 1 redirects the moment
    // one exists, so this is a guard, not a reachable state.
    if (!trip) return null;

    switch (step) {
        case 'pricing':
            return <StepPricing trip={trip} />;

        case 'rules':
            return <StepRules trip={trip} />;

        case 'schedule':
            return <StepSchedule trip={trip} />;

        case 'location':
            return <StepLocation trip={trip} />;

        case 'media':
            return <StepMedia trip={trip} />;

        case 'content':
            return <StepContent trip={trip} />;

        case 'reach':
            return <StepReach trip={trip} />;

        case 'review':
            return <StepReview trip={trip} />;

        default:
            return null;
    }
}
