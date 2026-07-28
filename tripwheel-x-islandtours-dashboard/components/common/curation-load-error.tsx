'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';

/**
 * Error state for editors whose Save is a REPLACE-ALL write. A failed load
 * must never look like an empty list: the empty view invites a Save, and a
 * replace-all Save built from unseeded state would wipe every existing row.
 * Rendering this instead of the editor keeps the Save button unreachable
 * until a reload succeeds.
 */
export function CurationLoadError({
  label,
  error,
  onRetry,
}: {
  /** What failed to load, e.g. "Our Picks". */
  label: string;
  error?: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 border border-destructive/30 bg-destructive/5 py-12 text-center">
      <HugeiconsIcon icon={Alert02Icon} className="size-8 text-destructive" />
      <p className="text-sm font-medium text-destructive">
        Could not load {label}.
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {error instanceof Error ? error.message : 'The server did not respond.'}{' '}
        Editing is disabled so a save cannot overwrite the existing content.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <HugeiconsIcon icon={RefreshIcon} />
        Retry
      </Button>
    </div>
  );
}
