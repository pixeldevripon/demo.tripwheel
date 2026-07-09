/**
 * Pure mappers from backend tour shapes to the UI `TourListing` consumed by
 * `TourCard`. No server/client-only imports — safe in both bundles.
 */
import type { TourListing } from '@/components/frontend/tour-card';
import type { TourBadge } from '@/components/frontend/tour-badge';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { CollectionRenderTour } from '@/types/collection';
import type { SearchHit } from '@/types/search';

/**
 * Client-side mirror of the backend `deriveTourBadge` (master §3.6 priority:
 * sponsored > likelyToSellOut > mostPopular > new). Admin tour rows don't carry a
 * server-derived badge, so the dashboard derives it from the raw signals to show
 * the same chip the public site would. First match wins.
 */
export function deriveTourBadge(t: {
  isSponsored?: boolean;
  likelyToSellOut?: boolean;
  likelyToSellOutOverride?: boolean | null;
  aggregateRating?: number | null;
  aggregateReviewCount?: number;
  publishedAt?: string | null;
}): TourBadge {
  if (t.isSponsored) return 'sponsored';
  if (t.likelyToSellOutOverride ?? t.likelyToSellOut ?? false) return 'likelyToSellOut';
  const reviews = t.aggregateReviewCount ?? 0;
  if (reviews >= 10 && (t.aggregateRating ?? 0) >= 4.5) return 'mostPopular';
  if (reviews === 0 && t.publishedAt) {
    const published = new Date(t.publishedAt).getTime();
    if (Number.isFinite(published) && Date.now() - published < 30 * 864e5) return 'new';
  }
  return null;
}

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
  const price = Math.round(Number(tour.priceFrom ?? tour.basePrice ?? 0));
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
    duration: formatDuration(tour.durationMinutesFrom, tour.durationMinutesTo, duration),
    pickupAvailable: tour.pickupModel !== 'NONE',
    price,
    priceUnit: tour.pricingModel === 'PER_PERSON' ? 'per' : 'perGroup',
    priceVaries: false,
    freeCancellation: (tour.cancellationHours ?? 0) > 0,
  };
}

/** Map a search hit to a `TourListing` for `TourCard`. */
export function searchHitToListing(
  hit: SearchHit,
  locale: Locale,
  duration: DurationDict,
): TourListing {
  const price = Math.round(Number(hit.priceFrom ?? hit.basePrice ?? 0));
  const hasReviews = hit.aggregateReviewCount > 0;
  return {
    id: hit.id,
    href: hit.destinationSlug
      ? localizeHref(locale, `/${hit.destinationSlug}/${hit.slug}`)
      : undefined,
    images: hit.images.map((img) => img.url).filter(Boolean),
    // Badge is derived server-side (master §3.6/§3.7); pass it through verbatim.
    badge: hit.badge ?? null,
    rating: hasReviews ? hit.aggregateRating ?? undefined : undefined,
    reviewCount: hasReviews ? hit.aggregateReviewCount : undefined,
    title: hit.title,
    duration: formatDuration(hit.durationMinutesFrom, hit.durationMinutesTo, duration),
    pickupAvailable: hit.pickupModel !== 'NONE',
    price,
    priceUnit: hit.pricingModel === 'PER_PERSON' ? 'per' : 'perGroup',
    priceVaries: false,
    freeCancellation: (hit.cancellationHours ?? 0) > 0,
  };
}
