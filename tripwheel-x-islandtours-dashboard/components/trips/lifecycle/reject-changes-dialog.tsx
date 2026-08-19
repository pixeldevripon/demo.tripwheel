'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/**
 * "Request changes" review dialog, shared by the tour row actions and the
 * wizard review step (code-review M4 — the two were near-verbatim copies).
 *
 * The dialog owns the note text + the minimum-length gate. It does NOT know how
 * to reject: the caller wires the mutation and its OWN success toast via
 * `onConfirm`, because the two surfaces word that toast differently and unifying
 * it would change user-facing copy. Close the dialog from the caller's
 * `onSuccess` (`onOpenChange(false)`); the note resets itself on close.
 */

/** Minimum actionable note length before "Request changes" enables. */
export const MIN_REJECT_NOTE = 5;

interface RejectChangesDialogProps {
    tripName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** True while the reject mutation is in flight (disables the controls). */
    isPending: boolean;
    /** Called with the trimmed note when the admin confirms. */
    onConfirm: (note: string) => void;
}

export function RejectChangesDialog({
    tripName,
    open,
    onOpenChange,
    isPending,
    onConfirm,
}: RejectChangesDialogProps) {
    const [note, setNote] = useState('');

    function handleOpenChange(next: boolean) {
        // Reset the note whenever the dialog closes (cancel or after success).
        if (!next) setNote('');
        onOpenChange(next);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/* Wide enough for a REAL note (client 2026-08-15): the admin
                writes field-by-field guidance here, not one line. Caps at
                the viewport on small screens. */}
            <DialogContent className='max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl lg:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>
                        Request changes on &ldquo;{tripName}&rdquo;?
                    </DialogTitle>
                    <DialogDescription>
                        The note below is shown to the operator - tell them
                        exactly what to fix so they can resubmit.
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={1000}
                    rows={8}
                    className='min-h-40 resize-y'
                    placeholder='e.g. The hero photo is blurry and the overview needs at least two paragraphs.'
                />
                <p className='text-right text-2xs text-content-subtle'>
                    {note.length}/1000
                </p>
                <DialogFooter>
                    <Button
                        variant='outline'
                        disabled={isPending}
                        onClick={() => handleOpenChange(false)}>
                        Back
                    </Button>
                    <Button
                        variant='destructive'
                        disabled={isPending || note.trim().length < MIN_REJECT_NOTE}
                        onClick={() => onConfirm(note.trim())}>
                        Request changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
