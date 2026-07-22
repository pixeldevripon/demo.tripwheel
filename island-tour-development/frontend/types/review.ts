/**
 * Public review shapes — the response of `GET /reviews?tourId=…` (backend
 * `ReviewResponseDto`, list served by `ReviewsService`). The list is paginated
 * and returns approved reviews only, with `comment` already resolved to the
 * requested locale (fallback to any). Date fields arrive as ISO strings.
 * Neutral (type-only) so it is safe in both server and client bundles.
 */
import type { Locale } from '@/lib/constants/locales';

/** `helpful` is absent by design: helpful votes are deferred to V2 by the master. */
export type ReviewSort = 'newest' | 'rating_desc' | 'rating_asc';

export interface PublicReview {
  id: string;
  tourId: string;
  operatorId: string;
  /** Overall rating 1-5. */
  rating: number;
  /** Value-for-money sub-rating. */
  ratingValue: number | null;
  /** Guide/host sub-rating. */
  ratingGuide: number | null;
  /** Safety/organization sub-rating. */
  ratingSafety: number | null;
  title: string | null;
  /** Body in the requested locale (fallback to any). */
  comment: string | null;
  /** Locale the returned `comment` is in. */
  locale: Locale;
  /**
   * True when `comment` is LD32 machine output rather than the guest's own
   * words. Drives the "Translated by Google" label and the show-original toggle.
   */
  isMachineTranslated: boolean;
  /**
   * The guest's own words, shipped ALONGSIDE the translation so the toggle is
   * instant and in place. Null when `comment` already is the original.
   */
  originalComment: string | null;
  /** Locale the guest wrote in. */
  originalLocale: Locale | null;
  /** Short reviewer label, e.g. "Ada B." (never a full name). */
  reviewerInitial: string | null;
  /** ISO 3166 country code, e.g. "NL". */
  reviewerCountry: string | null;
  travelMonth: number | null;
  travelYear: number | null;
  /** Guest type (LD36): `COUPLE` | `FAMILY` | `FRIENDS` | `SOLO`, or null if skipped. */
  reviewerType: string | null;
  /** Photo URLs attached to the review. */
  photos: string[];
  /** Admin-set highlight chips (pre-AI LD29 Tier 3). */
  themeTags: string[];
  /** Deferred to V2 - never incremented, so never sorted or displayed. */
  helpfulCount: number;
  /** Always `NATIVE` on public reads: only booking-gated reviews are published. */
  source: string;
  isVerified: boolean;
  moderationStatus: string;
  /**
   * Published response body (text only; no author name on the payload).
   *
   * Renamed from `operatorResponse` / `operatorRespondedAt` when LD37 landed.
   * `responseAuthor` is the discriminator: `PLATFORM` at launch, `OPERATOR` from
   * phase 4. Nothing here is type-checked against the backend, so a rename like
   * that one fails SILENTLY - the response simply stops rendering. Keep this
   * mirror in step with `backend/src/reviews/dto/review.dto.ts`.
   */
  responseText: string | null;
  responseAuthor: string | null;
  responseAt: string | null;
  createdAt: string;
}

export interface PublicReviewList {
  total: number;
  page: number;
  limit: number;
  data: PublicReview[];
}

/** One row of the star distribution chart (LD31). */
export interface RatingBucket {
  /** Star value 1-5. */
  stars: number;
  count: number;
}

/**
 * One theme chip (FE-9). `tag` is a valid `themeTag` filter value for
 * `GET /reviews` - the chips and the filter speak the same vocabulary, so a
 * chip can never select nothing.
 */
export interface ThemeFacet {
  tag: string;
  count: number;
}

/**
 * A depth-filter option that actually returns something (Phase 7). The UI
 * offers only these, so a filter can never be a dead end the user has to undo.
 */
export interface ReviewFacet {
  value: string;
  count: number;
}

/**
 * `GET /reviews/summary?tourId=…` - the single source of LD11 truth.
 *
 * The backend resolves which rating to display: a tour shows its OWN rating at
 * >= 3 approved reviews; below that it borrows the operator's, but only if the
 * operator is established (>= 10 reviews AND >= 4.0 avg); otherwise no rating is
 * shown at all. Do not re-derive this on the frontend - `source` is the answer.
 */
export interface PublicReviewSummary {
  tourId: string;
  /** Which entity the displayed rating belongs to. */
  source: 'tour' | 'operator' | 'none';
  /** Displayed rating (1dp), or null when nothing should render. */
  rating: number | null;
  /** Review count behind the DISPLAYED rating (operator's when borrowed). */
  reviewCount: number;
  /**
   * This tour's OWN approved-review count. Every render threshold keys off this,
   * never off `reviewCount`: the LD29 preview (3-9), the star chart (>= 3, LD31),
   * the sort control (>= 10) and the filter bar (>= 20) (LD30).
   */
  approvedCount: number;
  /** Approved-only, ordered [5*, 4*, 3*, 2*, 1*]. */
  distribution: RatingBucket[];
  /** Theme tags on this tour's approved reviews, most-used first (FE-9). */
  themes: ThemeFacet[];
  /** Guest types present (LD36). Valid `reviewerType` filter values. */
  guestTypes: ReviewFacet[];
  /**
   * Languages reviews were WRITTEN in - not what a reader can see. LD32 makes
   * every review readable in every locale, so filtering on the display locale
   * would match everything; this is "reviews from Dutch speakers".
   */
  languages: ReviewFacet[];
  /**
   * Approved reviews carrying at least one photo. The photo carousel is gated
   * on this at >= 3 (FE-10) - it counts REVIEWS, not photos, so one guest's
   * three snapshots cannot open a strip that reads as three people's.
   */
  photoCount: number;
  avgValue: number | null;
  avgGuide: number | null;
  avgSafety: number | null;
}

/**
 * `GET /reviews/invitation/:token` - what the tokenized review page may know.
 *
 * Deliberately narrow. The token travels in an email and may be forwarded, so it
 * must never unlock the booking's price, contact details or payment data.
 */
export interface PublicReviewInvitation {
  token: string;
  tourId: string;
  tourName: string | null;
  tourSlug: string | null;
  destinationSlug: string | null;
  heroImage: string | null;
  operatorName: string | null;
  guestFirstName: string | null;
  /** Tour date, `YYYY-MM-DD` (local). */
  travelDate: string;
  alreadyReviewed: boolean;
}
