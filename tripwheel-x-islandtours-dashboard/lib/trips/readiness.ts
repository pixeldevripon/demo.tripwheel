import type { TripListItem } from '@/types/trip';

/**
 * Publish-readiness computation (04 §2.2 C) - pure, view-free, so the rail,
 * the Publish gate and any future server component share ONE truth.
 *
 * Two separate lists on purpose:
 * - `getPublishChecks` mirrors the backend publish validator (the five checks
 *   the old DRAFT-only card showed). The Publish button is disabled while any
 *   fail - the client stops offering an action the backend will reject. The
 *   client rule must stay a STRICT SUBSET of the backend's (06 risk #2);
 *   if the backend gate ever loosens, loosen here first.
 * - `getListingChecks` is the "6th requirement" the old card omitted: passing
 *   publish does NOT list the tour. Listing needs bookable availability
 *   (schedules + capacity) in the next 30 days. These never block Publish -
 *   they exist so "published but invisible" stops being a surprise.
 */
export interface ReadinessCheck {
    key: string;
    label: string;
    passed: boolean;
    /** The `?tab=` section that fixes an unmet check. */
    tab: string;
}

export function getPublishChecks(
    trip: Pick<
        TripListItem,
        'imageCount' | 'highlightCount' | 'heroImage' | 'priceFrom' | 'basePrice'
    >,
    hasEnOverview: boolean,
): ReadinessCheck[] {
    const imageCount = trip.imageCount ?? 0;
    const highlightCount = trip.highlightCount ?? 0;
    return [
        {
            key: 'images',
            label: 'At least 5 images uploaded',
            passed: imageCount >= 5,
            tab: 'images',
        },
        {
            key: 'hero',
            label: 'Hero image set',
            passed: !!trip.heroImage,
            tab: 'images',
        },
        {
            key: 'highlights',
            label: 'At least 3 highlights added',
            passed: highlightCount >= 3,
            tab: 'highlights',
        },
        {
            key: 'overview',
            label: 'English overview filled',
            passed: hasEnOverview,
            // Editable in the Content → Copy section (EnglishContentEditor) -
            // a publish requirement stays satisfiable inside the editor.
            tab: 'copy',
        },
        {
            key: 'price',
            label: 'Price set (base price or age band)',
            passed: trip.priceFrom != null || trip.basePrice != null,
            tab: 'pricing',
        },
    ];
}

/**
 * The capacity check is GONE (2026-07-29). It read "Capacity set (max party
 * size or per-schedule override)" and could pass for two different reasons,
 * which made it the most confusing line on the screen - and it pointed at two
 * different steps depending on which reason applied.
 *
 * `maxPartySize` is NOT NULL as of the `20260729190000_max_party_size_required`
 * migration, so capacity ALWAYS resolves: a departure takes its schedule's
 * `capacityOverride`, else the tour's max. A check that can never fail is not a
 * check.
 */
export function getListingChecks(
    trip: Pick<TripListItem, 'isBookable'>,
): ReadinessCheck[] {
    return [
        {
            key: 'bookable',
            label: 'Bookable departures in the next 30 days',
            passed: trip.isBookable,
            tab: 'schedules',
        },
    ];
}
