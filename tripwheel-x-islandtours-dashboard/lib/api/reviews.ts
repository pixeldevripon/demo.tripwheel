import type {
  ReviewStats,
  AdminReview,
  BulkModeratePayload,
  DeleteReviewPayload,
  ModerateReviewPayload,
  PaginatedReviews,
  RespondPayload,
  Review,
  ReviewModerationLogEntry,
  ReviewsQueryParams,
} from '@/types/review';
import { revalidateReviewWrite } from './cache-revalidation';
import { apiFetch, buildQuery } from './fetch';

/**
 * Review moderation.
 *
 * ## The one thing to remember here
 * The backend review routes are TOP-LEVEL (`PATCH /reviews/:id/moderate`), so the
 * path carries the REVIEW id and `apiFetch`'s automatic tag mapping cannot derive
 * the TOUR id. That granular `tour:<id>` tag is what refreshes the tour detail
 * page's rating, count and star chart. Without it an approval updates the review
 * list while the number above it stays stale for a full `cacheLife('days')`.
 *
 * So every mutating call here ALSO calls `revalidateReviewWrite(tourId)` with the
 * tour id from the row it just acted on. Follow the DATA, not the URL.
 */
export const reviewsApi = {
  getAll(params: ReviewsQueryParams = {}): Promise<PaginatedReviews> {
    return apiFetch<PaginatedReviews>(`/reviews/admin${buildQuery({ ...params })}`);
  },

  /** The same queue, hard-scoped by the backend to the caller's own tours. */
  getMine(params: ReviewsQueryParams = {}): Promise<PaginatedReviews> {
    return apiFetch<PaginatedReviews>(`/reviews/operator${buildQuery({ ...params })}`);
  },

  getById(id: string): Promise<Review> {
    return apiFetch<Review>(`/reviews/${id}`);
  },

  history(id: string): Promise<ReviewModerationLogEntry[]> {
    return apiFetch<ReviewModerationLogEntry[]>(`/reviews/${id}/history`);
  },

  async moderate(
    id: string,
    payload: ModerateReviewPayload,
    tourId?: string,
  ): Promise<Review> {
    const res = await apiFetch<Review>(`/reviews/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    revalidateReviewWrite(tourId ?? res.tourId);
    return res;
  },

  async bulkModerate(
    payload: BulkModeratePayload,
    tourIds: string[] = [],
  ): Promise<{ updated: number; status: string }> {
    const res = await apiFetch<{ updated: number; status: string }>(
      '/reviews/bulk-moderate',
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    // One bust per affected tour: a bulk approve can span many tours, and each
    // one's detail page carries its own aggregate.
    for (const tourId of new Set(tourIds)) revalidateReviewWrite(tourId);
    return res;
  },

  async respond(
    id: string,
    payload: RespondPayload,
    tourId?: string,
  ): Promise<Review> {
    const res = await apiFetch<Review>(`/reviews/${id}/response`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    revalidateReviewWrite(tourId ?? res.tourId);
    return res;
  },

  async setThemeTags(
    id: string,
    themeTags: string[],
    tourId?: string,
  ): Promise<Review> {
    const res = await apiFetch<Review>(`/reviews/${id}/theme-tags`, {
      method: 'PATCH',
      body: JSON.stringify({ themeTags }),
    });
    revalidateReviewWrite(tourId ?? res.tourId);
    return res;
  },

  async setFeatured(
    id: string,
    isFeatured: boolean,
    tourId?: string,
  ): Promise<Review> {
    const res = await apiFetch<Review>(`/reviews/${id}/feature`, {
      method: 'PATCH',
      body: JSON.stringify({ isFeatured }),
    });
    revalidateReviewWrite(tourId ?? res.tourId);
    return res;
  },

  async remove(
    id: string,
    payload: DeleteReviewPayload,
    tourId?: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const res = await apiFetch<{ id: string; deleted: boolean }>(
      `/reviews/${id}`,
      { method: 'DELETE', body: JSON.stringify(payload) },
    );
    revalidateReviewWrite(tourId);
    return res;
  },

  /** Resolve or dismiss an operator flag. Never changes the review's status. */
  resolveFlag(
    flagId: string,
    payload: { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string },
  ) {
    return apiFetch(`/reviews/flags/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

/** DASH-9 review analytics. Scoped server-side by the caller's role. */
export const reviewAnalyticsApi = {
  get(params: { from?: string; to?: string; granularity?: 'month' | 'day' } = {}) {
    return apiFetch<ReviewStats>(`/analytics/reviews${buildQuery({ ...params })}`);
  },
};
