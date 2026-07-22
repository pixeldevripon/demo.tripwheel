'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useRole } from '@/contexts/role-context';
import { useReviews } from '@/hooks/reviews/use-reviews';
import type { ReviewModerationStatus, ReviewsQueryParams } from '@/types/review';
import { ReviewAnalytics } from './review-analytics';
import { ReviewsTable } from './reviews-table';

/**
 * Owns the server-driven list state for the moderation queue.
 *
 * ## Two things worth knowing
 *
 * 1. **Pending is a filter DEFAULT, not a hard exclusion** (the same idiom as the
 *    cancellations queue). A moderation queue is a work list, so it opens on what
 *    still needs a decision - but the full history stays one dropdown away rather
 *    than being unreachable.
 *
 * 2. **Role decides the endpoint, not the filter.** An operator hits
 *    `/reviews/operator`, which the backend scopes to their own tours *after*
 *    applying the query params, so no combination of filters can widen it. Scoping
 *    on the client would be a suggestion; scoping on the server is a rule.
 */
export function ReviewsListView() {
  const { role, can } = useRole();
  const {
    page,
    limit,
    search,
    debouncedSearch,
    filters,
    setPage,
    setLimit,
    setSearch,
    setFilter,
  } = useTableState();

  const scope = can('APPROVE_REVIEW') ? 'admin' : 'operator';

  const status = (filters.status ?? 'PENDING') as ReviewModerationStatus;

  const params: ReviewsQueryParams = {
    page,
    limit,
    status,
    ...(filters.rating ? { rating: Number(filters.rating) } : {}),
    ...(filters.tourId ? { tourId: filters.tourId } : {}),
    ...(filters.flagged === 'true' ? { flagged: true } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const { data, isLoading } = useReviews(params, scope);

  return (
    <div className='space-y-6'>
      {/* DASH-9. Above the queue: the queue is the work, these are the numbers
          that tell you whether the work is going anywhere. Renders nothing for
          a role without VIEW_ANALYTICS. */}
      <ReviewAnalytics />

      <ReviewsTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={limit}
        isLoading={isLoading}
        searchValue={search}
        filters={{ ...filters, status }}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onFilterChange={setFilter}
      />
      {role === 'TOUR_OPERATOR' && (
        <p className='text-xs text-content-muted'>
          You can read every review of your tours and flag one for policy review.
          Publishing decisions are made by Island Tours - reviews are never
          removed for being negative.
        </p>
      )}
    </div>
  );
}
