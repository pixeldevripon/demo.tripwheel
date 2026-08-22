/**
 * Pure mappers from the backend `PublicReview` to the UI shapes consumed by the
 * tour detail page's review components (`TourReview` for the preview strip,
 * `FullReview` for the full section). No server/client-only imports - safe in
 * both bundles.
 *
 * The backend payload doesn't match the UI 1:1, so these adapters transform:
 *   - `reviewerInitial` -> `name`
 *   - `reviewerCountry` (ISO code OR English name) -> localized country name
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

/**
 * English country name -> ISO alpha-2 code, built once and cached.
 *
 * There is no built-in list of region codes (`Intl.supportedValuesOf` covers
 * currencies and time zones but not regions), so the map is derived: every
 * two-letter combination is asked for its English name, and a code that answers
 * with something other than itself is a real one. 676 lookups, once, behind a
 * lazy getter - and only ever reached by data that is NOT already a code.
 */
let nameToCode: Map<string, string> | null = null;
function countryCodeFromName(name: string): string | null {
  if (!nameToCode) {
    nameToCode = new Map();
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    const A = 'A'.charCodeAt(0);
    for (let i = 0; i < 26; i += 1) {
      for (let j = 0; j < 26; j += 1) {
        const code = String.fromCharCode(A + i, A + j);
        const label = english.of(code);
        if (label && label !== code) nameToCode.set(label.toLowerCase(), code);
      }
    }
  }
  return nameToCode.get(name.trim().toLowerCase()) ?? null;
}

/**
 * Reviewer country, localized to the page (Pastel #55: "Nederland on the Dutch
 * pages").
 *
 * TAKES EITHER A CODE OR AN ENGLISH NAME, because the column holds names today.
 * `reviewerCountry` is a bare `String?` and the seeded rows read "United
 * Kingdom", not "GB" - so the previous version, which assumed a code and passed
 * anything else through unchanged, silently shipped English country names on
 * all seven locales. `Intl.DisplayNames.of('United Kingdom')` throws, the catch
 * returned the input, and the bug looked exactly like working code.
 *
 * A stored name is resolved back to its code first, then localized. Anything
 * unrecognised is returned verbatim - a country we cannot place is still better
 * shown than dropped.
 */
function countryName(value: string | null, locale: Locale): string {
  if (!value) return '';
  const code = /^[A-Za-z]{2}$/.test(value)
    ? value.toUpperCase()
    : countryCodeFromName(value);
  if (!code) return value;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? value;
  } catch {
    return value;
  }
}

/**
 * The reviewer line, composed once for BOTH surfaces (Pastel #55): the preview
 * cards beside the gallery and the full reviews section further down. The
 * client asked for one format on the page, and two components each joining
 * their own parts is how the page ends up with two.
 *
 * Order is `Name · Country · Month Year`, and every empty part is dropped
 * rather than left as a stray separator - a review with no country reads
 * "Maria S. · July 2026", not "Maria S. ·  · July 2026".
 *
 * "Verified" is deliberately NOT in here. It carries a tooltip in the full
 * section (FE-5, the disclosure of last resort) and so has to stay a real
 * element there; folding it into a joined string would silently drop that.
 * Callers append it themselves.
 */
export function reviewerLead(parts: {
  name: string;
  country: string;
  /** Localized month + year, e.g. "July 2026". */
  when: string;
}): string[] {
  return [parts.name, parts.country, parts.when].filter(Boolean);
}

/**
 * Month + year for the reviewer line, preferring WHEN THE TOUR WAS TAKEN over
 * when the review was written (FE-8): a review left six months late otherwise
 * claims the wrong season, which is the signal a traveller reads this line for.
 * Falls back to the written date so the line never loses its time entirely.
 */
function reviewMonthLabel(review: PublicReview, locale: Locale): string {
  const travel = formatTravelMonth(
    review.travelMonth,
    review.travelYear,
    locale,
  );
  if (travel) return travel;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(review.createdAt));
}

/** Map a review to the preview-strip card shape. */
export function toTourReview(review: PublicReview, locale: Locale): TourReview {
  return {
    id: review.id,
    name: review.reviewerInitial ?? '',
    country: countryName(review.reviewerCountry, locale),
    // Month and year, not the full date (Pastel #55). A precise day is noise
    // on a card whose job is "recently, by someone like you".
    date: reviewMonthLabel(review, locale),
    rating: review.rating,
    text: review.comment ?? '',
    verified: review.isVerified,
  };
}

/**
 * Map a review to the full-section card shape.
 *
 * Two author labels, because a response can come from either party:
 * `hostLabel` is the operator's display name and `platformLabel` is ours. The
 * payload carries `responseAuthor` as the discriminator but no names, so the
 * caller supplies both and this picks.
 */
export function toFullReview(
  review: PublicReview,
  locale: Locale,
  hostLabel: string,
  platformLabel: string,
): FullReview {
  const full: FullReview = {
    id: review.id,
    rating: review.rating,
    name: review.reviewerInitial ?? '',
    country: countryName(review.reviewerCountry, locale),
    // The SAME month-and-year label the preview cards show, so the page has one
    // reviewer line rather than two formats for the same fact.
    date: reviewMonthLabel(review, locale),
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
      // WHO replied, from `responseAuthor` - not "whoever owns the tour".
      // Responses are platform-authored at launch (LD37), so labelling every
      // one with the operator's name told the reader the operator had replied
      // when Island Tours had. `responseAuthor` exists to answer exactly this
      // and was being ignored.
      name:
        review.responseAuthor === 'OPERATOR' ? hostLabel : platformLabel,
      date: review.responseAt
        ? formatReviewDate(review.responseAt, locale)
        : '',
    };
  }
  return full;
}
