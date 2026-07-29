/**
 * The ONE place that writes the `availability_dead_end` event to the GTM
 * dataLayer (AVAILABILITY-AND-DEPARTURES.md §8).
 *
 * The spec calls this a SILENT event, "for monitoring": nothing about the
 * traveller's screen depends on it, it is not a conversion, and it must never
 * block or delay the recovery block from rendering. It exists so the platform can
 * see how often travellers hit a sold-out tour - which is a supply problem to fix,
 * not a funnel step to optimise.
 */
import { trackingEnabled } from './booking-complete';

/**
 * Client-side de-dupe within a single page load. The dead-end flag is derived on
 * every store read, so without this the event would fire on each re-render (and
 * twice more under React StrictMode). Deliberately NOT sessionStorage - a second
 * visit to a still-sold-out tour IS a second data point.
 */
const pushed = new Set<string>();

/**
 * Push the one `availability_dead_end` event for this tour. No-op when tracking
 * is disabled, off the browser (SSR), or already pushed this load.
 *
 * `alternativeCount` is part of the payload because a dead end with 0 recoveries
 * is a materially worse event than one with 3 - it means the whole destination
 * had nothing bookable that week, and no amount of widget copy fixes that.
 */
export function pushAvailabilityDeadEnd(params: {
    tourId: string;
    tourSlug?: string;
    destinationSlug?: string;
    alternativeCount: number;
}): void {
    if (!trackingEnabled()) return;
    if (typeof window === 'undefined') return;
    if (pushed.has(params.tourId)) return;
    pushed.add(params.tourId);

    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
        event: 'availability_dead_end',
        tour_id: params.tourId,
        ...(params.tourSlug ? { tour_slug: params.tourSlug } : {}),
        ...(params.destinationSlug
            ? { destination: params.destinationSlug }
            : {}),
        alternative_count: params.alternativeCount,
    });
}
