/**
 * Client-side read for the all-sold-out dead end
 * (technical-doc/02-architecture/AVAILABILITY-AND-DEPARTURES.md §8).
 *
 * Deliberately a BROWSER fetch, not one of the cached `lib/api/public/*` server
 * loaders: whether a tour is in the dead end is only known after the widget's own
 * `/availability/calendar` call resolves in the browser, and the answer changes
 * the moment an operator reopens a departure. A cached server read would have to
 * be issued for every tour page on the off chance it is needed, and would then
 * serve a stale "sold out" recovery block to a tour that is bookable again.
 */
import { seg } from '@/lib/api/api-path';
import type { Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';
import { apiFetch } from './fetch';

/** A listing card plus the date that earned it a place in the recovery block. */
export interface TourAlternative extends SearchHit {
    /** `yyyy-MM-dd` of the earliest bookable departure inside the 7-day window. */
    nextAvailableDate: string | null;
}

/**
 * Up to 3 tours in the same destination that still have a bookable departure
 * within 7 days, ranked canonically and drawn from the source tour's category
 * first (the backend widens the ring only when it has to).
 *
 * Never throws for the caller's purposes - a failure resolves to `[]`, which the
 * widget renders as its plain no-availability state rather than an error.
 */
export async function getDeadEndAlternatives(
    tourId: string,
    locale: Locale,
    currency?: string,
    signal?: AbortSignal
): Promise<TourAlternative[]> {
    const params = new URLSearchParams({ locale });
    if (currency) params.set('currency', currency);
    return apiFetch<TourAlternative[]>(
        `/tours/${seg(tourId)}/alternatives?${params.toString()}`,
        { signal }
    );
}
