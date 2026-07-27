'use client';

import { StarIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/data-table/data-table';
import {
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TourFilterPopover } from '@/components/common/tour-filter-popover';
import { useRole } from '@/contexts/role-context';
import { useBulkModerateReviews } from '@/hooks/reviews/use-reviews';
import type { AdminReview, ReviewModerationStatus } from '@/types/review';
import { makeReviewColumns } from './review-columns';
import { ReviewDeleteDialog } from './review-delete-dialog';
import { ReviewDetailSheet } from './review-detail-sheet';
import { ReviewModerateDialog } from './review-moderate-dialog';
import { ReviewRowActions } from './review-row-actions';

const STATUS_OPTIONS: [ReviewModerationStatus | 'all', string][] = [
  ['all', 'All statuses'],
  ['PENDING', 'Pending'],
  ['APPROVED', 'Approved'],
  ['HELD', 'Held'],
  ['REJECTED', 'Rejected'],
];

const RATING_OPTIONS = ['all', '5', '4', '3', '2', '1'];

export function ReviewsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  filters,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
}: {
  data: AdminReview[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  filters: Record<string, string | undefined>;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onLimitChange: (l: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
}) {
  const { can } = useRole();
  const bulk = useBulkModerateReviews();

  // Index-based so the sheet's prev/next arrows can walk the current page.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const viewing = viewIndex != null ? (data[viewIndex] ?? null) : null;
  const openReview = (review: AdminReview) =>
    setViewIndex(data.findIndex((r) => r.id === review.id));
  const [moderating, setModerating] = useState<{
    review: AdminReview;
    status: ReviewModerationStatus;
  } | null>(null);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);

  const columns = makeReviewColumns((review) => (
    <ReviewRowActions
      review={review}
      onView={() => openReview(review)}
      onModerate={(status) => setModerating({ review, status })}
      onDelete={() => setDeleting(review)}
    />
  ));

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        onRowClick={openReview}
        pagination={{
          total,
          page,
          limit,
          onPageChange,
          onLimitChange,
        }}
        empty={{
          icon: StarIcon,
          title: 'No reviews here.',
          description:
            'Reviews arrive from the post-tour invitation. If the queue is empty, either everything is moderated or the review request schedule is switched off in Settings.',
        }}
        toolbar={(table) => (
          <>
            <TableSearchInput
              value={searchValue}
              onValueChange={onSearchChange}
              placeholder='Search reviewer or review text...'
            />
            <Select
              value={filters.status ?? 'PENDING'}
              onValueChange={(v) =>
                // 'all' is passed through, NOT dropped: clearing the key would
                // hit the list view's PENDING default and silently re-filter.
                onFilterChange('status', v)
              }>
              <SelectTrigger className='w-36 shrink-0'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.rating ?? 'all'}
              onValueChange={(v) =>
                onFilterChange('rating', v === 'all' ? undefined : v)
              }>
              <SelectTrigger className='w-32 shrink-0'>
                <SelectValue placeholder='Rating' />
              </SelectTrigger>
              <SelectContent>
                {RATING_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v === 'all' ? 'Any rating' : `${v} stars`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TourFilterPopover
              value={filters.tourId}
              onChange={(v) => onFilterChange('tourId', v)}
            />
          </>
        )}
        bulkActions={
          can('APPROVE_REVIEW')
            ? (rows, clearSelection) => (
                <Button
                  size='sm'
                  disabled={bulk.isPending}
                  onClick={() => {
                    const reviews = rows.map((r) => r.original);
                    bulk.mutate(
                      {
                        payload: {
                          ids: reviews.map((r) => r.id),
                          status: 'APPROVED',
                        },
                        // Every affected tour needs its own cache bust: a bulk
                        // approve can span many tours, each with its own
                        // aggregate on its own detail page.
                        tourIds: reviews.map((r) => r.tourId),
                      },
                      {
                        onSuccess: (res) => {
                          toast.success(`${res.updated} review(s) approved.`);
                          clearSelection();
                        },
                        onError: (err) =>
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : 'Bulk approve failed.',
                          ),
                      },
                    );
                  }}>
                  Approve selected
                </Button>
              )
            : undefined
        }
      />

      <ReviewDetailSheet
        review={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewIndex(null)}
        onPrev={
          viewIndex != null && viewIndex > 0
            ? () => setViewIndex(viewIndex - 1)
            : undefined
        }
        onNext={
          viewIndex != null && viewIndex < data.length - 1
            ? () => setViewIndex(viewIndex + 1)
            : undefined
        }
        position={
          viewIndex != null
            ? { index: viewIndex + 1, count: data.length }
            : undefined
        }
      />
      <ReviewModerateDialog
        review={moderating?.review ?? null}
        status={moderating?.status ?? null}
        open={!!moderating}
        onOpenChange={(o) => !o && setModerating(null)}
      />
      <ReviewDeleteDialog
        review={deleting}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </>
  );
}
