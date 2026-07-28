'use client';

import { StarIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/common/status-badge';
import { REVIEW_STATUS } from '@/components/common/status-maps';
import { SheetPager, type SheetPagerProps } from '@/components/common/detail-sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/contexts/role-context';
import {
  useModerateReview,
  useRespondToReview,
} from '@/hooks/reviews/use-reviews';
import type { AdminReview } from '@/types/review';

const GUEST_TYPE_LABEL: Record<string, string> = {
  COUPLE: 'Couple',
  FAMILY: 'Family',
  FRIENDS: 'Friends',
  SOLO: 'Solo',
};

/**
 * One review on one screen: the traveler's words first, then the verification
 * chain (booking reference -> tour -> operator) and the response thread.
 */
export function ReviewDetailSheet({
  review,
  open,
  onOpenChange,
  onPrev,
  onNext,
  position,
}: {
  review: AdminReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & SheetPagerProps) {
  const { can } = useRole();
  const [response, setResponse] = useState('');
  const respond = useRespondToReview();
  const moderate = useModerateReview();

  if (!review) return null;
  const meta = REVIEW_STATUS[review.moderationStatus];
  const canApprove =
    can('APPROVE_REVIEW') && review.moderationStatus !== 'APPROVED';

  async function approve() {
    try {
      await moderate.mutateAsync({
        id: review!.id,
        tourId: review!.tourId,
        payload: { status: 'APPROVED' },
      });
      toast.success('Review approved and published.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve the review.',
      );
    }
  }

  async function submitResponse() {
    if (!response.trim()) return;
    try {
      await respond.mutateAsync({
        id: review!.id,
        tourId: review!.tourId,
        response: response.trim(),
      });
      toast.success('Response published.');
      setResponse('');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to publish the response.',
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Sticky header; only the body scrolls. */}
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
        <SheetHeader className='border-b'>
          <div className='flex items-center justify-between gap-3 pr-8'>
            <div className='min-w-0'>
              <SheetTitle className='flex items-center gap-2'>
                <span className='flex items-center gap-1'>
                  <HugeiconsIcon
                    icon={StarIcon}
                    className='size-4 text-warning-solid'
                  />
                  {review.rating}
                </span>
                <StatusBadge variant={meta.variant} hint={meta.hint}>
                  {meta.label}
                </StatusBadge>
              </SheetTitle>
              <SheetDescription>
                {review.tourTitle ?? 'Unknown tour'}
                {review.operatorName ? ` · ${review.operatorName}` : ''}
              </SheetDescription>
            </div>
            <SheetPager onPrev={onPrev} onNext={onNext} position={position} />
          </div>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-8'>
          {/* The traveler's words - the reason this sheet exists - come first. */}
          <section>
            {review.title && (
              <h3 className='font-heading text-lg font-semibold'>
                {review.title}
              </h3>
            )}
            <p
              className={
                review.comment
                  ? 'mt-1 text-sm leading-relaxed whitespace-pre-wrap text-content-muted'
                  : 'mt-1 text-sm text-content-subtle italic'
              }>
              {review.comment ?? 'Rating only - no written review.'}
            </p>
            {review.photos.length > 0 && (
              <div className='mt-3 flex flex-wrap gap-2'>
                {review.photos.map((src) => (
                  <div
                    key={src}
                    className='relative size-20 overflow-hidden rounded-md bg-surface-inset'>
                    <Image
                      src={src}
                      alt=''
                      fill
                      sizes='80px'
                      className='object-cover'
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Verification chain - the whole "confirmed booking" promise in one card. */}
          <section className='grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-surface-inset p-4 text-sm sm:grid-cols-3'>
            <Meta label='Booking' value={review.bookingRef ?? '-'} />
            <Meta label='Source' value={review.source} />
            <Meta
              label='Reviewer'
              value={`${review.reviewerInitial ?? 'Anonymous'}${
                review.reviewerCountry ? ` (${review.reviewerCountry})` : ''
              }`}
            />
            <Meta
              label='Travelled as'
              value={
                review.reviewerType
                  ? GUEST_TYPE_LABEL[review.reviewerType]
                  : 'Not given'
              }
            />
            <Meta
              label='Travel date'
              value={
                review.travelMonth && review.travelYear
                  ? `${review.travelMonth}/${review.travelYear}`
                  : '-'
              }
            />
            <Meta
              label='Submitted'
              value={new Date(review.createdAt).toLocaleDateString()}
            />
          </section>

          {review.rejectionReason && (
            <section className='rounded-lg border border-danger-border bg-danger-subtle p-4'>
              <Label className='text-xs font-semibold uppercase'>
                Rejection ground
              </Label>
              <p className='mt-1 text-sm text-danger-fg'>
                {review.rejectionReason}
              </p>
            </section>
          )}

          {/* Response (LD37: platform-authored at launch, no editing once published). */}
          <section>
            <Label className='text-xs font-semibold uppercase'>Response</Label>
            {review.responseText ? (
              <div className='mt-2 rounded-lg bg-surface-inset p-4'>
                <p className='text-sm leading-relaxed whitespace-pre-wrap'>
                  {review.responseText}
                </p>
                <p className='mt-2 text-xs text-content-muted'>
                  {review.responseAuthor === 'OPERATOR'
                    ? 'Operator'
                    : 'Island Tours'}
                  {review.responseAt
                    ? ` · ${new Date(review.responseAt).toLocaleDateString()}`
                    : ''}{' '}
                  · published, cannot be edited
                </p>
              </div>
            ) : can('APPROVE_REVIEW') ? (
              <div className='mt-2 space-y-2'>
                <Textarea
                  rows={3}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder='Reply in the Island Tours voice. Once published this cannot be edited.'
                />
                <Button
                  size='sm'
                  disabled={!response.trim() || respond.isPending}
                  onClick={() => void submitResponse()}>
                  {respond.isPending ? 'Publishing...' : 'Publish response'}
                </Button>
              </div>
            ) : (
              <p className='mt-2 text-sm text-content-subtle italic'>
                No response yet.
              </p>
            )}
          </section>
        </div>

        {canApprove && (
          <SheetFooter className='border-t'>
            <Button
              disabled={moderate.isPending}
              onClick={() => void approve()}>
              <HugeiconsIcon icon={Tick02Icon} />
              {moderate.isPending ? 'Approving...' : 'Approve & publish'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-xs text-content-subtle uppercase'>{label}</div>
      <div className='mt-0.5 truncate font-medium'>{value}</div>
    </div>
  );
}
