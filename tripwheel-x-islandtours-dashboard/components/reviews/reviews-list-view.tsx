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
 * 1. **It opens on EVERY review, ordered pending-first.** The status filter used
 *    to default to PENDING, which answered "what needs a decision" by hiding
 *    everything else. Ordering answers it without the hiding: the undecided
 *    reviews sit on top and the rest of the history is already on the page, no
 *    dropdown required. The sort is a SERVER sort (`pending_first`) because this
 *    list is paginated server-side - sorting the fetched rows would only
 *    rearrange the current page, so page 2 would still be arbitrary.
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

  // Every status by default; `pending_first` below is what surfaces the work.
  // Narrowing to one status stays available, and "All statuses" is what the
  // control sends as `all` - which must map to an ABSENT status param, not a
  // literal, or the backend would filter on the string.
  const rawStatus = filters.status ?? 'all';
  const status =
    rawStatus === 'all' ? undefined : (rawStatus as ReviewModerationStatus);

  const params: ReviewsQueryParams = {
    page,
    limit,
    // Undecided reviews on top, newest first within each status group. Without
    // this the backend falls back to oldest-first across the whole list, which
    // with no status filter buries today's pending reviews behind the archive.
    sort: 'pending_first',
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
