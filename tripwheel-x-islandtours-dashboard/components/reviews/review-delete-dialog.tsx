'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Field, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteReview } from '@/hooks/reviews/use-reviews';
import type { AdminReview } from '@/types/review';

/**
 * Hard delete.
 *
 * The backend REQUIRES a documented ground from a moderator, so this dialog
 * cannot submit without one - and the audit row it writes SURVIVES the review,
 * which is the point: the record proving a removal happened must outlive the
 * thing removed.
 *
 * Rejecting is almost always the right action instead. Deleting destroys the
 * content; rejecting keeps it unpublished but inspectable.
 */
export function ReviewDeleteDialog({
  review,
  open,
  onOpenChange,
}: {
  review: AdminReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteReview();

  if (!review) return null;

  async function confirm() {
    if (!reason.trim()) {
      setError('A documented policy ground is required to remove a review.');
      return;
    }
    try {
      await remove.mutateAsync({
        id: review!.id,
        tourId: review!.tourId,
        payload: { reason: reason.trim() },
      });
      toast.success('Review deleted. The audit record is retained.');
      setReason('');
      setError(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete the review.',
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this review permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. In almost every case rejecting is the right
            action instead: it keeps the review unpublished but inspectable.
            Deleting destroys the content, though the audit record of the removal
            is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          <Label className='text-xs font-semibold uppercase'>
            Policy ground (required)
          </Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder='Fake, abusive, off-topic, or contains personal data. Never that the review is negative.'
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={remove.isPending}>
            {remove.isPending ? 'Deleting...' : 'Delete permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
