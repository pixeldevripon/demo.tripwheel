'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, StarIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OperatorFilterPopover } from '@/components/common/operator-filter-popover';
import { makeTripColumns } from '@/components/common/trip-columns';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useSetLocalsFavourite } from '@/hooks/locals-favourites/use-locals-favourites';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import { LocalsFavouriteDetailSheet } from './locals-favourite-detail-sheet';

interface LocalsFavouritesTableProps {
  data: TripListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

export function LocalsFavouritesTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: LocalsFavouritesTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TripListItem | null>(null);
  // Index-based so the sheet's prev/next arrows can walk the current page.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const viewing = viewIndex != null ? (data[viewIndex] ?? null) : null;

  const { data: session } = useSession();
  const { data: destinations } = useActiveDestinations();
  const { mutate: setFlag } = useSetLocalsFavourite();

  function applyFlag(tour: TripListItem, value: boolean) {
    setPendingId(tour.id);
    setFlag(
      { tourId: tour.id, value },
      {
        onSuccess: () =>
          toast.success(
            value
              ? `Marked "${tour.name}" as Locals' favourite`
              : `Removed "${tour.name}" from Locals' favourites`,
          ),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update.'),
        onSettled: () => {
          setPendingId(null);
          setRemoveTarget(null);
        },
      },
    );
  }

  function handleToggle(tour: TripListItem) {
    // Adding is direct; removing asks for confirmation (destructive-ish curation change).
    if (tour.isLocalsFavourite) {
      setRemoveTarget(tour);
    } else {
      applyFlag(tour, true);
    }
  }

  // Status + Pricing columns are off: this list is pinned to LIVE tours (only
  // they can appear on the public grid), and pricing lives in the sheet.
  const columns = makeTripColumns({
    showOperator: true,
    showSelect: false,
    showPerformance: true,
    showStatus: false,
    showPricing: false,
    currentUserEmail: session?.user?.email,
    actions: (tour) => {
      const on = tour.isLocalsFavourite;
      const busy = pendingId === tour.id;
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => handleToggle(tour)}
          aria-pressed={on}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
            on
              ? 'border-warning-border bg-warning-subtle text-warning-fg hover:bg-warning-subtle/80'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {busy ? (
            <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
          ) : (
            <HugeiconsIcon icon={StarIcon}
              className={cn('size-3.5', on && 'fill-rating text-rating')}
            />
          )}
          {on ? 'Favourite' : 'Mark'}
        </button>
      );
    },
  });

  return (
    <>
      <LocalsFavouriteDetailSheet
        trip={viewing}
        onToggle={handleToggle}
        isToggling={viewing != null && pendingId === viewing.id}
        onOpenChange={(open) => {
          if (!open) setViewIndex(null);
        }}
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
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        onRowClick={(t: TripListItem) =>
          setViewIndex(data.findIndex((r) => r.id === t.id))
        }
        pagination={{ total, page, limit, onPageChange, onLimitChange }}
        empty={{
          icon: StarIcon,
          title: 'No live tours found.',
          description: 'Nothing matches the current filters.',
        }}
        toolbar={(table) => (
          <>
            <DataTableSearch
              value={searchValue}
              onChange={onSearchChange}
              placeholder='Search tours...'
            />
            <Select
              value={filters.isLocalsFavourite ?? 'all'}
              onValueChange={(v) =>
                onFilterChange('isLocalsFavourite', v === 'all' ? undefined : v)
              }
            >
              <SelectTrigger className='w-40 shrink-0'>
                <SelectValue placeholder='Favourite' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All tours</SelectItem>
                <SelectItem value='true'>Locals&apos; favourites</SelectItem>
                <SelectItem value='false'>Not favourited</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.destinationId ?? 'all'}
              onValueChange={(v) =>
                onFilterChange('destinationId', v === 'all' ? undefined : v)
              }
            >
              <SelectTrigger className='w-44 shrink-0'>
                <SelectValue placeholder='Destination' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Destinations</SelectItem>
                {(destinations ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <OperatorFilterPopover
              value={filters.operatorId}
              onChange={(v) => onFilterChange('operatorId', v)}
            />
          </>
        )}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove Locals' favourite?"
        description={
          removeTarget
            ? `"${removeTarget.name}" will no longer be badged or surfaced in Locals' favourites grids.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={pendingId !== null}
        onConfirm={() => removeTarget && applyFlag(removeTarget, false)}
      />
    </>
  );
}
