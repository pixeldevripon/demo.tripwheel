/**
 * Trip creation wizard - the step registry (07 §2).
 *
 * ONE source of truth for the journey: order, copy, layout width, and the
 * legacy `?tab=` redirect map. The shell, the progress rail, the footer and
 * the review summary all read from here, so adding or reordering a step is a
 * single-file edit.
 *
 * Two deliberate rules encoded below:
 *
 * 1. `blocking` marks the ONLY steps that can refuse Continue, and they refuse
 *    it using the zod schema those fields already had - the wizard never
 *    invents a requirement the backend does not have. Every other step is
 *    walk-through: an operator can pass it empty and fix it from Review.
 *
 * 2. Completeness is a RAIL SIGNAL, not a gate - see `isStepComplete` at the
 *    bottom of this file. It is derived from the same
 *    fields `lib/trips/readiness.ts` reads, so the dot on step 6 and the
 *    publish check on step 9 can never disagree.
 */

import { getListingChecks, getPublishChecks } from '@/lib/trips/readiness';
import type { TripListItem } from '@/types/trip';

export type WizardStepId =
    | 'basics'
    | 'pricing'
    | 'rules'
    | 'schedule'
    | 'location'
    | 'media'
    | 'content'
    | 'reach'
    | 'review';

export interface WizardStepDef {
    id: WizardStepId;
    /** Progress rail label - must stay short enough for a pill. */
    label: string;
    /** Step screen heading. */
    title: string;
    /**
     * The step owns required fields in its existing schema, so Continue can
     * fail. See rule 1 in the file header.
     */
    blocking?: boolean;
}

export const WIZARD_STEPS: readonly WizardStepDef[] = [
    {
        id: 'basics',
        label: 'Basics',
        title: 'Basics',
        blocking: true,
    },
    {
        id: 'pricing',
        label: 'Pricing',
        title: 'Pricing',
        // Only UNIT tours have required fields here (existing superRefine).
        blocking: true,
    },
    {
        id: 'rules',
        label: 'Booking rules',
        title: 'Capacity and booking rules',
        // Asked BEFORE Schedule on purpose: maxPartySize is the default seat
        // count every schedule falls back on (07 §2.2 a) - and it is REQUIRED,
        // so this step can refuse Continue like basics and pricing.
        blocking: true,
    },
    {
        id: 'schedule',
        label: 'Schedule',
        title: 'Schedule and availability',
    },
    {
        id: 'location',
        label: 'Location',
        title: 'Location and route',
    },
    {
        id: 'media',
        label: 'Media',
        title: 'Photos',
    },
    {
        id: 'content',
        label: 'Description',
        title: 'Description and content',
    },
    {
        id: 'reach',
        label: 'Reach',
        title: 'Discovery and reach',
        // True by construction - the backend defaults every tour to
        // `tier_key='standard'`, so a loaded tour always has one.
        //
        // Nothing on this step is required - see `isStepComplete`.
    },
    {
        id: 'review',
        label: 'Review',
        title: 'Review and publish',
    },
] as const;

export const WIZARD_STEP_IDS: readonly WizardStepId[] = WIZARD_STEPS.map(
    s => s.id,
);

/** The last step - the review hub, and the landing screen in edit mode. */
export const REVIEW_STEP: WizardStepId = 'review';

export function getStep(id: WizardStepId): WizardStepDef {
    // Non-null: WizardStepId is derived from this very list.
    return WIZARD_STEPS.find(s => s.id === id)!;
}

export function getStepIndex(id: WizardStepId): number {
    return WIZARD_STEPS.findIndex(s => s.id === id);
}

export function getNextStep(id: WizardStepId): WizardStepId | null {
    const i = getStepIndex(id);
    return i >= 0 && i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1].id : null;
}

export function getPrevStep(id: WizardStepId): WizardStepId | null {
    const i = getStepIndex(id);
    return i > 0 ? WIZARD_STEPS[i - 1].id : null;
}

/**
 * Every `?tab=` value the old two-level editor understood, mapped onto the
 * step that now owns those fields. Readiness chips (`check.tab`), row actions,
 * bookmarks and the e2e specs all navigate by tab - they keep resolving
 * because of this map, so it must cover EVERY key in the old TAB_TO_GROUP.
 */
export const TAB_TO_STEP: Record<string, WizardStepId> = {
    // Setup
    details: 'rules',
    pricing: 'pricing',
    schedules: 'schedule',
    // Content
    copy: 'content',
    translations: 'content',
    images: 'media',
    highlights: 'content',
    inclusions: 'content',
    exclusions: 'content',
    itinerary: 'location',
    pickups: 'location',
    info: 'content',
    // Reach
    attributes: 'reach',
    promotion: 'reach',
    seo: 'reach',
};

/**
 * A legacy `?tab=` value used to name a whole screen. Most of those screens are
 * now a collapsible section inside a step, and arriving with it CLOSED makes a
 * deep link look broken - a readiness chip saying "fix this" that drops you on
 * a page where the thing to fix is folded away.
 *
 * This maps a tab onto the section its step should open on arrival. Section ids
 * match the `id` prop of the `WizardSection` that owns those fields; the wizard
 * scopes them by step when it reveals one.
 */
export const TAB_TO_SECTION: Record<string, string> = {
    details: 'group-size',
    schedules: 'weekly',
    copy: 'overview',
    translations: 'overview',
    highlights: 'highlights',
    inclusions: 'inclusions',
    exclusions: 'exclusions',
    itinerary: 'itinerary',
    pickups: 'pickup',
    info: 'info',
    attributes: 'attributes',
    promotion: 'tier',
    seo: 'seo',
};

function isStepId(value: string): value is WizardStepId {
    return (WIZARD_STEP_IDS as readonly string[]).includes(value);
}

/**
 * Resolve a URL parameter to a step. Accepts a new `?step=` value, an old
 * `?tab=` value, or nothing. `fallback` differs by mode: create starts at
 * `basics`, edit lands on the review hub (07 §6).
 */
export function resolveStepParam(
    raw: string | null | undefined,
    fallback: WizardStepId,
): WizardStepId {
    if (!raw) return fallback;
    if (isStepId(raw)) return raw;
    return TAB_TO_STEP[raw] ?? fallback;
}

// ── Step completeness ────────────────────────────────────────────────────────

/**
 * Which step OWNS each readiness check.
 *
 * Deliberately not `check.tab`: that field is a "where do I go to fix this"
 * hint and the capacity check swaps its own tab depending on whether a tour
 * has a party maximum, so keying ownership to it would let one check drift
 * between two steps.
 */
const CHECK_STEP: Record<string, WizardStepId> = {
    images: 'media',
    hero: 'media',
    highlights: 'content',
    overview: 'content',
    price: 'pricing',
    bookable: 'schedule',
};

/**
 * Is this step done?
 *
 * ONE definition, derived from `readiness.ts`, so the tick on the rail and the
 * checklist on Review can never disagree. A step is complete when no readiness
 * check it owns is failing - and a step that owns no checks is complete as
 * soon as the draft exists, because there is nothing on it that must be filled.
 *
 * The hand-written predicates this replaced invented requirements the platform
 * does not have. `rules` demanded `maxPartySize`, which is OPTIONAL - the
 * capacity check has always accepted per-schedule overrides instead
 * (`maxPartySize != null || isBookable`), so a live, fully bookable tour sat
 * on step 3 with a hollow circle forever. `location` demanded meeting-point
 * coordinates, which nothing requires at all.
 */
export function isStepComplete(
    step: WizardStepId,
    trip: TripListItem,
    hasEnOverview: boolean,
): boolean {
    // Publishing IS the completion of the review step - there is nothing to
    // fill in on it, only a decision to take.
    if (step === REVIEW_STEP) return trip.firstPublishedAt != null;

    const checks = [
        ...getPublishChecks(trip, hasEnOverview),
        ...getListingChecks(trip),
    ];
    return checks
        .filter(c => CHECK_STEP[c.key] === step)
        .every(c => c.passed);
}
