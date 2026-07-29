'use client';

import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (e.g. removals/deletes). */
  destructive?: boolean;
  /** Disable the confirm button while the action is in flight. */
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * Reusable confirmation dialog for any potentially-destructive dashboard action.
 * Controlled via `open`/`onOpenChange`. Keep one instance per view and drive its
 * content from state; do not render one per table row.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={loading}
            onClick={(e) => {
              // Keep the dialog mounted while the async action runs; the caller
              // closes it via onOpenChange on settle.
              e.preventDefault();
              onConfirm();
            }}
          >
            {/* The dialog stays open for the whole request (see above), so
                without this the confirm button just greys out and the user is
                left guessing whether their click registered. */}
            {loading && (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
