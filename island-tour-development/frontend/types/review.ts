/**
 * Public review shapes — the response of `GET /reviews?tourId=…` (backend
 * `ReviewResponseDto`, list served by `ReviewsService`). The list is paginated
 * and returns approved reviews only, with `comment` already resolved to the
 * requested locale (fallback to any). Date fields arrive as ISO strings.
 * Neutral (type-only) so it is safe in both server and client bundles.
 */
import type { Locale } from '@/lib/constants/locales';

export type ReviewSort = 'newest' | 'rating_desc' | 'rating_asc' | 'helpful';

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
  /** Short reviewer label, e.g. "Ada B." (never a full name). */
  reviewerInitial: string | null;
  /** ISO 3166 country code, e.g. "NL". */
  reviewerCountry: string | null;
  travelMonth: number | null;
  travelYear: number | null;
  /** Photo URLs attached to the review. */
  photos: string[];
  helpfulCount: number;
  isVerified: boolean;
  moderationStatus: string;
  /** Operator response body (text only; no author name on the payload). */
  operatorResponse: string | null;
  operatorRespondedAt: string | null;
  createdAt: string;
}

export interface PublicReviewList {
  total: number;
  page: number;
  limit: number;
  data: PublicReview[];
}
