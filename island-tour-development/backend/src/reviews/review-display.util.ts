/**
 * Pure review helpers - privacy-safe display, banned-word screening (LD9), and the
 * LD11 provider-rating cold-start resolution. No DB access; unit-tested in isolation.
 */

// LD11 cold-start thresholds.
export const MIN_TOUR_REVIEWS = 3; // a tour shows its OWN rating at ≥3 approved reviews
export const OPERATOR_FALLBACK_MIN_REVIEWS = 10; // else fall back to the operator only if…
export const OPERATOR_FALLBACK_MIN_RATING = 4.0; // …operator has ≥10 reviews AND ≥4.0 avg

/** "Ada B." - first name + last initial. Falls back gracefully on missing parts. */
export function reviewerInitial(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const first = firstName?.trim();
  if (!first) return null;
  const initial = lastName?.trim()?.[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

// Platform-wide banned words (LD9). Lowercased; matched on word boundaries.
const BANNED_WORDS = [
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'asshole',
  'bastard',
  'nigger',
  'faggot',
  'retard',
];

/** True if the text contains a banned word (case-insensitive, whole-word). */
export function containsBannedWord(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

export type RatingSource = 'tour' | 'operator' | 'none';

export interface RatingResolution {
  source: RatingSource;
  rating: number | null;
  reviewCount: number;
}

/**
 * LD11: a tour displays its own rating once it has ≥3 approved reviews. Below that it
 * borrows the operator's rating - but only if the operator is well-established
 * (≥10 reviews AND ≥4.0 avg). Otherwise no rating is shown.
 */
export function resolveRatingSource(input: {
  tourCount: number;
  tourRating: number | null;
  operatorCount: number;
  operatorRating: number | null;
}): RatingResolution {
  if (input.tourCount >= MIN_TOUR_REVIEWS && input.tourRating != null) {
    return {
      source: 'tour',
      rating: input.tourRating,
      reviewCount: input.tourCount,
    };
  }
  if (
    input.operatorCount >= OPERATOR_FALLBACK_MIN_REVIEWS &&
    input.operatorRating != null &&
    input.operatorRating >= OPERATOR_FALLBACK_MIN_RATING
  ) {
    return {
      source: 'operator',
      rating: input.operatorRating,
      reviewCount: input.operatorCount,
    };
  }
  return { source: 'none', rating: null, reviewCount: input.tourCount };
}

/** Round a raw average to 1 decimal place (e.g. 4.27 → 4.3), or null. */
export function roundRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}
