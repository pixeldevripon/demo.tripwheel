/**
 * Pure mappers from the backend `PublicReview` to the UI shapes consumed by the
 * tour detail page's review components (`TourReview` for the preview strip,
 * `FullReview` for the full section). No server/client-only imports - safe in
 * both bundles.
 *
 * The backend payload doesn't match the UI 1:1, so these adapters transform:
 *   - `reviewerInitial` -> `name`
 *   - `reviewerCountry` (ISO code) -> localized country name
 *   - `createdAt` (ISO) -> localized "12 March 2026" date label
 *   - `comment` -> `text`; `isVerified` -> `verified`
 *   - `photos` (URL[]) passed through as image URLs
 */
import type { Locale } from '@/lib/constants/locales';
import type { PublicReview } from '@/types/review';
import type { TourReview } from '@/components/frontend/tour-reviews';
import type { FullReview } from '@/components/frontend/tour-reviews-section';

/** Localized long-form date, e.g. "12 March 2026" (locale-ordered). */
function formatReviewDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

/** ISO country code -> localized country name ("NL" -> "Netherlands"). */
function countryName(code: string | null, locale: Locale): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Map a review to the preview-strip card shape. */
export function toTourReview(review: PublicReview, locale: Locale): TourReview {
  return {
    id: review.id,
    name: review.reviewerInitial ?? '',
    country: countryName(review.reviewerCountry, locale),
    date: formatReviewDate(review.createdAt, locale),
    rating: review.rating,
    text: review.comment ?? '',
    verified: review.isVerified,
  };
}

/**
 * Map a review to the full-section card shape. `hostLabel` is the response
 * author label - the review payload carries the operator response text/date but
 * no author name, so the caller supplies a display label.
 */
export function toFullReview(
  review: PublicReview,
  locale: Locale,
  hostLabel: string,
): FullReview {
  const full: FullReview = {
    id: review.id,
    rating: review.rating,
    name: review.reviewerInitial ?? '',
    date: formatReviewDate(review.createdAt, locale),
    text: review.comment ?? '',
    photos: review.photos.length > 0 ? review.photos : undefined,
  };
  if (review.operatorResponse) {
    full.response = {
      text: review.operatorResponse,
      name: hostLabel,
      date: review.operatorRespondedAt
        ? formatReviewDate(review.operatorRespondedAt, locale)
        : '',
    };
  }
  return full;
}
