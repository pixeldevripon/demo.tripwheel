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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useModerateReview } from '@/hooks/reviews/use-reviews';
import type { AdminReview, ReviewModerationStatus } from '@/types/review';

/**
 * The documented policy grounds on which a review may be removed.
 *
 * THERE IS DELIBERATELY NO "NEGATIVE", "UNFAIR" OR "BAD FOR BUSINESS" OPTION.
 * Under the Omnibus Directive a review may be removed for being fake, abusive,
 * off-topic or containing personal data - never for its score. Making the
 * grounds a closed list rather than free text is what keeps that true in
 * practice: a moderator cannot type "1 star, hurts the tour" into a dropdown.
 */
const REJECTION_GROUNDS = [
    ['Fake or not a real customer', 'Fake or not a real customer'],
    ['Abusive or offensive language', 'Abusive or offensive language'],
    ['Off-topic - not about this tour', 'Off-topic - not about this tour'],
    ['Contains personal data', 'Contains personal data'],
] as const;

export function ReviewModerateDialog({
    review,
    status,
    open,
    onOpenChange,
}: {
    review: AdminReview | null;
    status: ReviewModerationStatus | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [ground, setGround] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const moderate = useModerateReview();

    if (!review || !status) return null;
    const isReject = status === 'REJECTED';

    const copy: Record<string, { title: string; body: string; cta: string }> = {
        APPROVED: {
            title: 'Publish this review?',
            body: 'It goes live on the tour page and starts counting toward the tour and operator ratings.',
            cta: 'Approve',
        },
        HELD: {
            title: 'Hold this review?',
            body: 'It stays unpublished and out of every aggregate while you decide. This is not a rejection - no reason is recorded against the reviewer.',
            cta: 'Hold',
        },
        REJECTED: {
            title: 'Reject this review?',
            body: 'It will not be published. A documented policy ground is required and is written to the permanent audit trail.',
            cta: 'Reject',
        },
    };
    const c = copy[status];

    async function confirm() {
        if (isReject && !ground) {
            setError('Select the policy ground for this rejection.');
            return;
        }
        try {
            await moderate.mutateAsync({
                id: review!.id,
                tourId: review!.tourId,
                payload: {
                    status: status as 'APPROVED' | 'HELD' | 'REJECTED',
                    ...(isReject && {
                        rejectionReason: note.trim()
                            ? `${ground} - ${note.trim()}`
                            : ground,
                    }),
                },
            });
            toast.success(`Review ${c.cta.toLowerCase()}d.`);
            setGround('');
            setNote('');
            setError(null);
            onOpenChange(false);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'That did not go through.'
            );
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{c.title}</AlertDialogTitle>
                    <AlertDialogDescription>{c.body}</AlertDialogDescription>
                </AlertDialogHeader>

                {isReject && (
                    <div className='space-y-3'>
                        <Field>
                            <Label className='text-xs font-medium uppercase'>
                                Policy ground
                            </Label>
                            <Select
                                value={ground}
                                onValueChange={v => {
                                    setGround(v);
                                    setError(null);
                                }}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a ground' />
                                </SelectTrigger>
                                <SelectContent>
                                    {REJECTION_GROUNDS.map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {error && <FieldError>{error}</FieldError>}
                        </Field>
                        <Field>
                            <Label className='text-xs font-medium uppercase'>
                                Note (optional)
                            </Label>
                            <Textarea
                                rows={3}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder='Anything a colleague reading the audit trail would need to know.'
                            />
                        </Field>
                        <p className='text-xs text-content-muted'>
                            A low score is never a ground for rejection. Publish
                            it and, if it deserves one, add a response.
                        </p>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={e => {
                            e.preventDefault();
                            void confirm();
                        }}
                        disabled={moderate.isPending}>
                        {moderate.isPending ? 'Saving...' : c.cta}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

