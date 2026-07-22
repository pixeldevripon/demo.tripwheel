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
import type { TourReview } from '@/components/frontend/tour/tour-reviews';
import type { FullReview } from '@/components/frontend/tour/tour-reviews-section';

/** Localized long-form date, e.g. "12 March 2026" (locale-ordered). */
function formatReviewDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

/**
 * Localized travel month, e.g. "March 2026" (FE-8).
 *
 * Built from the review's `travelMonth`/`travelYear` (when the tour was taken),
 * NOT from `createdAt` (when the review was written) - a review left six months
 * late would otherwise claim the wrong season, which is exactly the signal a
 * traveler is reading this line for.
 *
 * Returns '' when either part is missing so the caller can drop the line
 * entirely rather than render a half-date.
 */
function formatTravelMonth(
  month: number | null,
  year: number | null,
  locale: Locale,
): string {
  if (!month || !year) return '';
  // Day 1 at UTC noon: a midnight date can roll back a day in a negative-offset
  // timezone and take the month with it.
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

/** Locale code -> its name in the READER's language ("nl" -> "Dutch"). */
function languageName(code: Locale, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
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
    verified: review.isVerified,
    // LD32. Both texts travel together so the toggle needs no second request
    // and no per-review translation URL.
    isMachineTranslated: review.isMachineTranslated,
    originalText: review.originalComment,
    originalLanguage: review.originalLocale
      ? languageName(review.originalLocale, locale)
      : '',
    travelLabel: formatTravelMonth(
      review.travelMonth,
      review.travelYear,
      locale,
    ),
    // Passed through RAW, not localized here: the guest-type label lives in the
    // dictionary alongside the rest of the section's copy, and this module is
    // deliberately dictionary-free so it stays a pure mapper.
    guestType: review.reviewerType,
  };
  if (review.responseText) {
    full.response = {
      text: review.responseText,
      name: hostLabel,
      date: review.responseAt
        ? formatReviewDate(review.responseAt, locale)
        : '',
    };
  }
  return full;
}
