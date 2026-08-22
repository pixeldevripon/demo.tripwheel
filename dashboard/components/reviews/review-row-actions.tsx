'use client';

import {
  CheckmarkCircle02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PauseIcon,
  ViewIcon,
  CancelCircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRole } from '@/contexts/role-context';
import type { AdminReview, ReviewModerationStatus } from '@/types/review';

/**
 * Row actions.
 *
 * Gated actions are ABSENT, never disabled (the dashboard RBAC convention). An
 * operator sees View only: they may read their reviews and flag one for policy
 * review, but they have no approve, reject, unpublish or delete anywhere - the
 * moment buyers suspect operators can scrub bad reviews, every five-star rating
 * on the site becomes worthless.
 */
export function ReviewRowActions({
  review,
  onView,
  onModerate,
  onDelete,
}: {
  review: AdminReview;
  onView: () => void;
  onModerate: (status: ReviewModerationStatus) => void;
  onDelete: () => void;
}) {
  const { can } = useRole();
  const canModerate = can('APPROVE_REVIEW');
  const canDelete = can('DELETE_REVIEW');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-8'
          onClick={(e) => e.stopPropagation()}>
          <HugeiconsIcon icon={MoreHorizontalIcon} className='size-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Review</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <HugeiconsIcon icon={ViewIcon} className='size-4' />
          View
        </DropdownMenuItem>

        {canModerate && (
          <>
            <DropdownMenuSeparator />
            {review.moderationStatus !== 'APPROVED' && (
              <DropdownMenuItem onClick={() => onModerate('APPROVED')}>
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className='size-4'
                />
                Approve
              </DropdownMenuItem>
            )}
            {review.moderationStatus !== 'HELD' && (
              <DropdownMenuItem onClick={() => onModerate('HELD')}>
                <HugeiconsIcon icon={PauseIcon} className='size-4' />
                Hold for a second look
              </DropdownMenuItem>
            )}
            {review.moderationStatus !== 'REJECTED' && (
              <DropdownMenuItem onClick={() => onModerate('REJECTED')}>
                <HugeiconsIcon icon={CancelCircleIcon} className='size-4' />
                Reject
              </DropdownMenuItem>
            )}
          </>
        )}

        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant='destructive'
              onClick={onDelete}>
              <HugeiconsIcon icon={Delete02Icon} className='size-4' />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
