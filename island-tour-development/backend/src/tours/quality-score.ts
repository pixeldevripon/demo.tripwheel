/**
 * quality_score - master §7.2 (nightly job, read-only at query time, 0-100).
 *
 *   quality_score = (avg_rating / 5)               * 40
 *                 + (min(review_count, 100) / 100) * 25
 *                 + (listing_completeness / 100)   * 20
 *                 + (conversion_rate / max_conv)   * 15
 *
 * - `max_conv` is the highest conversion rate among active tours in the SAME
 *   primary category, recomputed per run (category-relative so niche categories
 *   are not penalised against day-trip conversion).
 * - Conversion needs pageview tracking, which is not live yet (master §9 CAPI /
 *   tracking is pending). Until it exists every tour's conversion input is null
 *   and the term contributes 0 for everyone - relative order within a tier is
 *   unaffected. The input is threaded through so the tracking module can plug
 *   real rates in without touching the formula.
 * - The score is ONLY a tie-breaker within a tier (`tier_rank` stays dominant).
 *
 * Shared by the nightly job and any admin/on-demand recompute so the formula
 * can never drift between callers.
 */

/** Weights per master §7.2 - must sum to 100. */
export const QS_WEIGHT_RATING = 40;
export const QS_WEIGHT_REVIEWS = 25;
export const QS_WEIGHT_COMPLETENESS = 20;
export const QS_WEIGHT_CONVERSION = 15;

/** Review-volume cap: the term maxes out at 100 reviews. */
export const QS_REVIEW_CAP = 100;

/**
 * The listing-spec checks that make up `listing_completeness` (master §7.2:
 * "fraction of the listing spec filled - images, description, attributes,
 * meeting point, ..."). Each check contributes equally; the fraction is
 * checks-passed / checks-total (0-1). Launch heuristic over the fields the
 * listing spec (E.3) actually requires - extend the list, never re-weight
 * individual checks.
 */
export interface CompletenessInput {
  imageCount: number;
  /** EN (base-locale) translation row - the canonical content. */
  hasOverview: boolean;
  /**
   * The SEO summary line (`shortDescription`).
   *
   * This slot used to read the separate `description` translation field, which
   * was removed from the product - nothing on the public site rendered it, so
   * operators wrote body copy no traveller could read.
   *
   * It is `shortDescription` rather than a length test on the overview. A
   * length test was tried and rejected: seeded overviews run 180-233 chars
   * with a median of 201, so ANY threshold in that band splits the catalogue
   * on noise - 199 fails, 201 passes, and neither means anything. The overview
   * is a short pitch by design; it was never a second body of copy, so it
   * cannot stand in for one.
   *
   * `shortDescription` is a real, separately-authored field that no other
   * check counts, which keeps this at ten checks. Dropping to nine would
   * re-weight the rest, which §7.2 forbids.
   */
  hasShortDescription: boolean;
  highlightCount: number;
  inclusionCount: number;
  exclusionCount: number;
  languageCount: number;
  attributeCount: number;
  /** Meeting point set: coordinates or a departure city. */
  hasMeetingPoint: boolean;
  /** Itinerary / locations rows (OCTO locations). */
  locationCount: number;
}

export function listingCompleteness(input: CompletenessInput): number {
  const checks: boolean[] = [
    input.imageCount >= 4, // gallery: hero + >=3 (E.3 image spec)
    input.hasOverview,
    input.hasShortDescription,
    input.highlightCount >= 3, // master: highlights <3 counts as incomplete
    input.inclusionCount >= 1,
    input.exclusionCount >= 1,
    input.languageCount >= 1,
    input.attributeCount >= 3, // filterable attributes power §7 filters
    input.hasMeetingPoint,
    input.locationCount >= 1,
  ];
  const passed = checks.filter(Boolean).length;
  return passed / checks.length;
}

export interface QualityScoreInput {
  /** 0-5 aggregate rating (null when unrated). */
  avgRating: number | null;
  reviewCount: number;
  /** 0-1 fraction from `listingCompleteness`. */
  completeness: number;
  /** Tour conversion rate (null until pageview tracking lands). */
  conversionRate: number | null;
  /** Highest conversion among active tours in the same primary category. */
  maxCategoryConversion: number | null;
}

/** The §7.2 formula. Returns 0-100 rounded to 2 decimals (DB Decimal(6,2)). */
export function computeQualityScore(input: QualityScoreInput): number {
  const rating = ((input.avgRating ?? 0) / 5) * QS_WEIGHT_RATING;
  const reviews =
    (Math.min(input.reviewCount, QS_REVIEW_CAP) / QS_REVIEW_CAP) *
    QS_WEIGHT_REVIEWS;
  const completeness = input.completeness * QS_WEIGHT_COMPLETENESS;
  const conversion =
    input.conversionRate != null &&
    input.maxCategoryConversion != null &&
    input.maxCategoryConversion > 0
      ? (input.conversionRate / input.maxCategoryConversion) *
        QS_WEIGHT_CONVERSION
      : 0;
  const total = rating + reviews + completeness + conversion;
  return Math.round(total * 100) / 100;
}
