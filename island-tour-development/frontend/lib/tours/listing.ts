/**
 * Pure mappers from backend tour shapes to the UI `TourListing` consumed by
 * `TourCard`. No server/client-only imports — safe in both bundles.
 */
import type { TourListing } from '@/components/frontend/tour-card';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';

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
    badge: null,
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
