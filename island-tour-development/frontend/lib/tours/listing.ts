/**
 * Pure mappers from backend tour shapes to the UI `TourListing` consumed by
 * `TourCard`. No server/client-only imports — safe in both bundles.
 */
import type { TourListing } from '@/components/frontend/tour-card';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { resolveDisplayPrice } from '@/lib/currency/current';
import type { CollectionRenderTour } from '@/types/collection';
import type { SearchHit } from '@/types/search';
import { priceUnitKey } from '@/lib/tours/pricing-label';

/**
 * The sitewide tour-card grid: ONE card per row on mobile, 3 from `sm`, 4 from
 * `lg`.
 *
 * Every full-page listing of tour cards uses this exact string - All Tours,
 * destination listings, global search, the wishlist, and the skeletons that
 * stand in for them. It lives here, next to the mappers that build the cards,
 * because it was previously copy-pasted into each list AND into three separate
 * constants in `skeletons/skeleton-bar.ts`. Design v2 moved the listings to a
 * single mobile column and the copies did not follow, so search and the
 * wishlist sat on two cramped columns while every other listing showed one.
 *
 * Add a listing, import this. Do NOT re-type the classes.
 *
 * Deliberately NOT covered: the mobile horizontal snap-carousels (destination
 * "explore" rows, hub also-worth, category you-might-like). Those are a
 * different pattern on purpose and only their desktop grid is comparable.
 */
export const TOUR_CARD_GRID =
  'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-4';

/** Duration label strings (from the `search` dictionary section). */
export type DurationDict = {
  hours: string;
  hour: string;
  minutes: string;
  range: string;
};

/** Format minutes as a localized human duration ("2 hours", "45 min", "2 to 2.5 hours"). */
export function formatDuration(
  fromMin: number | null,
  toMin: number | null,
  d: DurationDict,
): string {
  if (!fromMin) return '';
  const asHours = (min: number) => {
    const h = min / 60;
    return Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10);
  };

  if (toMin && toMin !== fromMin) {
    if (fromMin < 60 && toMin < 60) {
      return d.minutes.replace('{value}', `${fromMin}-${toMin}`);
    }
    return d.range.replace('{from}', asHours(fromMin)).replace('{to}', asHours(toMin));
  }
  if (fromMin < 60) return d.minutes.replace('{value}', String(fromMin));
  if (fromMin === 60) return d.hour;
  return d.hours.replace('{value}', asHours(fromMin));
}

/**
 * Map a collection render tour to a `TourListing` for `TourCard`. When `rank` is
 * provided the card renders the ranked collection variant (numbered badge + the
 * rationale as its description line). MANUAL cards carry a `rationale`; DYNAMIC
 * cards have none, so the description is simply omitted.
 */
export function collectionTourToListing(
  tour: CollectionRenderTour,
  destinationSlug: string,
  locale: Locale,
  duration: DurationDict,
  rank?: number,
): TourListing {
  const { price, currency, priceDisplay } = resolveDisplayPrice(tour, locale);
  const hasReviews = tour.aggregateReviewCount > 0;
  return {
    id: tour.id,
    rank,
    href: localizeHref(locale, `/${destinationSlug}/${tour.slug}`),
    images: (tour.images ?? []).map((img) => img.url).filter(Boolean),
    badge: tour.badge ?? null,
    rating: hasReviews ? tour.aggregateRating ?? undefined : undefined,
    reviewCount: hasReviews ? tour.aggregateReviewCount : undefined,
    title: tour.name,
    // MANUAL cards carry an editorial rationale; DYNAMIC cards fall back to the
    // tour's own localized overview (Option 1) so the blurb stays correct as the
    // filter set changes.
    description: tour.rationale ?? tour.overview ?? undefined,
    shortDescription: tour.shortDescription ?? null,
    duration: formatDuration(tour.durationMinutesFrom, tour.durationMinutesTo, duration),
    hub: tour.hubs?.[0] ?? null,
    pickupAvailable: tour.pickupModel !== 'NONE',
    price,
    currency,
    priceDisplay,
    priceUnit: priceUnitKey(tour),
    priceVaries: false,
    freeCancellation: (tour.cancellationHours ?? 0) > 0,
  };
}

/**
 * Map a search hit to a `TourListing` for `TourCard`.
 *
 * `date` is the day the results were filtered by, if any. It rides along on the
 * card's href so opening a result keeps the answer the traveller already gave -
 * the widget preselects it rather than asking again. Omit it and the links are
 * exactly as before.
 */
export function searchHitToListing(
  hit: SearchHit,
  locale: Locale,
  duration: DurationDict,
  date?: string,
): TourListing {
  const { price, currency, priceDisplay } = resolveDisplayPrice(hit, locale);
  const hasReviews = hit.aggregateReviewCount > 0;
  return {
    id: hit.id,
    href: hit.destinationSlug
      ? localizeHref(
          locale,
          `/${hit.destinationSlug}/${hit.slug}${date ? `?date=${date}` : ''}`,
        )
      : undefined,
    images: hit.images.map((img) => img.url).filter(Boolean),
    // Badge is derived server-side (master §3.6/§3.7); pass it through verbatim.
    badge: hit.badge ?? null,
    rating: hasReviews ? hit.aggregateRating ?? undefined : undefined,
    reviewCount: hasReviews ? hit.aggregateReviewCount : undefined,
    title: hit.title,
    shortDescription: hit.shortDescription ?? null,
    duration: formatDuration(hit.durationMinutesFrom, hit.durationMinutesTo, duration),
    hub: hit.hubs?.[0] ?? null,
    pickupAvailable: hit.pickupModel !== 'NONE',
    price,
    currency,
    priceDisplay,
    priceUnit: priceUnitKey(hit),
    priceVaries: false,
    freeCancellation: (hit.cancellationHours ?? 0) > 0,
  };
}
