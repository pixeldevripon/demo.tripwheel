'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { reviewsApi } from '@/lib/api/reviews';
import type {
  BulkModeratePayload,
  DeleteReviewPayload,
  ModerateReviewPayload,
  ReviewsQueryParams,
} from '@/types/review';

export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  list: (params: ReviewsQueryParams, scope: 'admin' | 'operator') =>
    [...reviewKeys.lists(), scope, params] as const,
  details: () => [...reviewKeys.all, 'detail'] as const,
  detail: (id: string) => [...reviewKeys.details(), id] as const,
  history: (id: string) => [...reviewKeys.all, 'history', id] as const,
};

/**
 * The moderation queue. `scope` decides which endpoint answers: an operator gets
 * the backend-scoped list, which cannot be widened by any query param.
 */
export function useReviews(
  params: ReviewsQueryParams = {},
  scope: 'admin' | 'operator' = 'admin',
) {
  return useQuery({
    queryKey: reviewKeys.list(params, scope),
    queryFn: () =>
      scope === 'operator'
        ? reviewsApi.getMine(params)
        : reviewsApi.getAll(params),
    placeholderData: keepPreviousData,
  });
}

/** A review's append-only audit trail. Only fetched when the sheet opens. */
export function useReviewHistory(id: string | null) {
  return useQuery({
    queryKey: reviewKeys.history(id ?? ''),
    queryFn: () => reviewsApi.history(id!),
    enabled: !!id,
  });
}

/**
 * Count of reviews awaiting a decision - drives the sidebar badge.
 * `limit: 1` because only `total` is read; the rows are never rendered.
 */
export function usePendingReviewCount(enabled = true) {
  return useQuery({
    queryKey: reviewKeys.list({ status: 'PENDING', limit: 1 }, 'admin'),
    queryFn: () => reviewsApi.getAll({ status: 'PENDING', limit: 1 }),
    enabled,
    select: (d) => d.total,
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: reviewKeys.all });
    if (id) void qc.invalidateQueries({ queryKey: reviewKeys.detail(id) });
  };
}

export function useModerateReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      tourId,
    }: {
      id: string;
      payload: ModerateReviewPayload;
      tourId?: string;
    }) => reviewsApi.moderate(id, payload, tourId),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useBulkModerateReviews() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      payload,
      tourIds,
    }: {
      payload: BulkModeratePayload;
      tourIds: string[];
    }) => reviewsApi.bulkModerate(payload, tourIds),
    onSuccess: () => invalidate(),
  });
}

export function useRespondToReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      response,
      tourId,
    }: {
      id: string;
      response: string;
      tourId?: string;
    }) => reviewsApi.respond(id, { response }, tourId),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useSetReviewThemeTags() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      themeTags,
      tourId,
    }: {
      id: string;
      themeTags: string[];
      tourId?: string;
    }) => reviewsApi.setThemeTags(id, themeTags, tourId),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useFeatureReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      isFeatured,
      tourId,
    }: {
      id: string;
      isFeatured: boolean;
      tourId?: string;
    }) => reviewsApi.setFeatured(id, isFeatured, tourId),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      tourId,
    }: {
      id: string;
      payload: DeleteReviewPayload;
      tourId?: string;
    }) => reviewsApi.remove(id, payload, tourId),
    onSuccess: () => invalidate(),
  });
}
