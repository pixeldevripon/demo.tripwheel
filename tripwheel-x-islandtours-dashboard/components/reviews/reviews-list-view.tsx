'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useRole } from '@/contexts/role-context';
import { useReviews } from '@/hooks/reviews/use-reviews';
import type { ReviewModerationStatus, ReviewsQueryParams } from '@/types/review';
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

  // PENDING is the DEFAULT, not a floor. `?? 'PENDING'` treated "All statuses"
  // (which the control sends as `all`) as "unset" and put the queue straight
  // back on Pending, so the full history was unreachable - the exact opposite
  // of the "history is one dropdown away" rule this list is built on.
  const rawStatus = filters.status ?? 'PENDING';
  const status =
    rawStatus === 'all' ? undefined : (rawStatus as ReviewModerationStatus);

  const params: ReviewsQueryParams = {
    page,
    limit,
    // Omitted entirely on "all" - the backend treats an absent status as
    // "every status", and sending `undefined` explicitly would serialise.
    ...(status ? { status } : {}),
    ...(filters.rating ? { rating: Number(filters.rating) } : {}),
    ...(filters.tourId ? { tourId: filters.tourId } : {}),
    ...(filters.flagged === 'true' ? { flagged: true } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const { data, isLoading } = useReviews(params, scope);

  return (
    <div className='space-y-4'>
      <ReviewsTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={limit}
        isLoading={isLoading}
        searchValue={search}
        filters={{ ...filters, status: rawStatus }}
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
