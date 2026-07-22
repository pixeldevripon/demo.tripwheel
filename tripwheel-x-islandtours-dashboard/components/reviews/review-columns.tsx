'use client';

import { StarIcon, Flag02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@/components/common/status-badge';
import { REVIEW_STATUS } from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import type { AdminReview } from '@/types/review';

/**
 * Seven columns, matching the shape `app/(app)/reviews/loading.tsx` already
 * presumed: select, rating, reviewer, tour, status, submitted, actions.
 */
export function makeReviewColumns(
  renderActions: (review: AdminReview) => React.ReactNode,
): ColumnDef<AdminReview>[] {
  return [
    {
      id: 'select',
      size: 48,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label='Select row'
        />
      ),
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      size: 120,
      cell: ({ row }) => (
        <span className='flex items-center gap-1.5 tabular-nums'>
          <HugeiconsIcon
            icon={StarIcon}
            className='size-4 text-warning-solid'
          />
          <span className='font-medium'>{row.original.rating}</span>
          {row.original.photos.length > 0 && (
            <span className='ml-1 text-xs text-content-muted'>
              {row.original.photos.length} photo
              {row.original.photos.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'reviewer',
      header: 'Reviewer',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className='min-w-0'>
            <div className='truncate font-medium'>
              {r.reviewerInitial ?? 'Anonymous'}
              {r.reviewerCountry ? (
                <span className='ml-1.5 text-xs font-normal text-content-muted'>
                  {r.reviewerCountry}
                </span>
              ) : null}
            </div>
            {r.comment ? (
              <div className='truncate text-xs text-content-muted'>
                {r.comment}
              </div>
            ) : (
              <div className='text-xs text-content-subtle italic'>
                Rating only
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'tour',
      header: 'Tour',
      cell: ({ row }) => (
        <div className='min-w-0'>
          <div className='truncate'>{row.original.tourTitle ?? '-'}</div>
          <div className='truncate text-xs text-content-muted'>
            {row.original.operatorName ?? '-'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'moderationStatus',
      header: 'Status',
      size: 150,
      cell: ({ row }) => {
        const meta = REVIEW_STATUS[row.original.moderationStatus];
        return (
          <span className='flex items-center gap-2'>
            <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
            {row.original.openFlagCount > 0 && (
              // A flag is a request, not an action - it never changes the
              // status, so it needs its own marker or it is invisible.
              <span
                title={`${row.original.openFlagCount} open flag(s)`}
                className='flex items-center gap-0.5 text-xs text-danger-fg'>
                <HugeiconsIcon icon={Flag02Icon} className='size-3.5' />
                {row.original.openFlagCount}
              </span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Submitted',
      size: 130,
      cell: ({ row }) => (
        <span className='text-sm text-content-muted tabular-nums'>
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 48,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => renderActions(row.original),
    },
  ];
}
