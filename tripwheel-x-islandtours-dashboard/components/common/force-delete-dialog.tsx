'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

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

interface ForceDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityName: string;
  /** One sentence describing what will be permanently removed */
  consequenceNote: string;
  onConfirm: () => void;
  isPending: boolean;
  confirmLabel?: string;
}

export function ForceDeleteDialog({
  open,
  onOpenChange,
  title,
  entityName,
  consequenceNote,
  onConfirm,
  isPending,
  confirmLabel = 'Permanently Delete',
}: ForceDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-danger-subtle shrink-0">
              <HugeiconsIcon icon={Delete02Icon} className="size-5 text-danger-fg" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-content">{entityName}</strong>?
              </p>
              <p className="text-xs text-content-muted">{consequenceNote}</p>
              <p className="text-xs font-medium text-danger-fg">
                This action is irreversible and cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? 'Deleting...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
