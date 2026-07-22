/**
 * Review moderation shapes - mirrors `backend/src/reviews/dto/review.dto.ts`.
 *
 * Hand-written on purpose (02-EXTRACTION-SPEC §3.3: two independent consumers
 * each maintaining their own view of a shared HTTP contract is the correct
 * microservice shape). The cost is that a backend rename fails SILENTLY here -
 * nothing type-checks across the wire - so keep this in step with the DTO.
 */

export type ReviewModerationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'HELD'
  | 'REJECTED';

/** Statuses a moderator may transition INTO. `PENDING` is entry-only. */
export const MODERATABLE_STATUSES = [
  'APPROVED',
  'HELD',
  'REJECTED',
] as const satisfies readonly ReviewModerationStatus[];

/** Guest type (LD36). Collected from launch; the consumer filter is V2. */
export type ReviewerType = 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'SOLO';

/** Only `NATIVE` may appear on a tour page or enter a tour aggregate. */
export type ReviewSource =
  | 'NATIVE'
  | 'IMPORTED_OPERATOR'
  | 'IMPORTED_THIRD_PARTY';

/** LD37: platform-authored at launch, operator-authored from phase 4. */
export type ReviewResponseAuthor = 'PLATFORM' | 'OPERATOR';

/**
 * The narrow, documented grounds on which a review may be flagged or removed.
 * There is deliberately no "negative" or "unfair" option: suppressing a review
 * for its sentiment is an unfair commercial practice under the Omnibus
 * Directive, and it is what makes every other rating on the site worthless.
 */
export type ReviewFlagReason =
  | 'FAKE'
  | 'ABUSIVE'
  | 'OFF_TOPIC'
  | 'PERSONAL_DATA'
  | 'NOT_A_CUSTOMER';

export interface Review {
  id: string;
  tourId: string;
  operatorId: string;
  rating: number;
  ratingValue: number | null;
  ratingGuide: number | null;
  ratingSafety: number | null;
  title: string | null;
  comment: string | null;
  locale: string;
  reviewerInitial: string | null;
  reviewerCountry: string | null;
  reviewerType: ReviewerType | null;
  travelMonth: number | null;
  travelYear: number | null;
  photos: string[];
  themeTags: string[];
  helpfulCount: number;
  source: ReviewSource;
  isVerified: boolean;
  moderationStatus: ReviewModerationStatus;
  responseText: string | null;
  responseAuthor: ReviewResponseAuthor | null;
  responseAt: string | null;
  createdAt: string;
}

/** A moderation-queue row: the public shape plus triage context. */
export interface AdminReview extends Review {
  tourTitle: string | null;
  operatorName: string | null;
  /** Human booking reference - the verification audit trail. */
  bookingRef: string | null;
  isFeatured: boolean;
  rejectionReason: string | null;
  openFlagCount: number;
}

/** One entry in a review's append-only audit trail. */
export interface ReviewModerationLogEntry {
  id: string;
  actorId: string | null;
  fromStatus: ReviewModerationStatus | null;
  toStatus: ReviewModerationStatus | null;
  isDeletion: boolean;
  reason: string | null;
  createdAt: string;
}

export interface ReviewsQueryParams {
  page?: number;
  limit?: number;
  status?: ReviewModerationStatus;
  tourId?: string;
  operatorId?: string;
  rating?: number;
  hasPhotos?: boolean;
  flagged?: boolean;
  locale?: string;
  from?: string;
  to?: string;
  search?: string;
  /** Queue default is oldest-first: a backlog is cleared from the bottom. */
  sort?: 'oldest' | 'newest';
}

export interface PaginatedReviews {
  total: number;
  page: number;
  limit: number;
  data: AdminReview[];
}

export interface ModerateReviewPayload {
  status: (typeof MODERATABLE_STATUSES)[number];
  /** Required when rejecting. Must be a documented POLICY ground. */
  rejectionReason?: string;
}

export interface BulkModeratePayload extends ModerateReviewPayload {
  ids: string[];
}

export interface RespondPayload {
  response: string;
}

export interface DeleteReviewPayload {
  /** Required for a moderator; optional when an author removes their own. */
  reason?: string;
}
