'use client';

import { useState } from 'react';
import { Loader2Icon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableSearch,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OperatorFilterPopover } from '@/components/trips/operator-filter-popover';
import { makeTripColumns } from '@/components/trips/trip-columns';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useSetLocalsFavourite } from '@/hooks/locals-favourites/use-locals-favourites';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { TripListItem, TripStatus } from '@/types/trip';

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

  const columns = makeTripColumns({
    showOperator: true,
    showSelect: false,
    showPerformance: true,
    currentUserEmail: session?.user?.email,
    actions: (tour) => {
      const on = tour.isLocalsFavourite;
      const busy = pendingId === tour.id;
      // Only LIVE tours show on the public grid, so marking a non-live tour is
      // blocked. Removing an existing flag stays allowed regardless of status.
      const blocked = !on && tour.status !== 'LIVE';
      const btn = (
        <button
          type="button"
          disabled={busy || blocked}
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
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <StarIcon
              className={cn('size-3.5', on && 'fill-rating text-rating')}
            />
          )}
          {on ? 'Favourite' : 'Mark'}
        </button>
      );
      if (!blocked) return btn;
      return (
        <Tooltip>
          {/* span wrapper so the tooltip fires on a disabled button */}
          <TooltipTrigger asChild>
            <span className="inline-flex">{btn}</span>
          </TooltipTrigger>
          <TooltipContent>Only live tours can be Locals&apos; favourites</TooltipContent>
        </Tooltip>
      );
    },
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ total, page, limit, onPageChange, onLimitChange }}
        empty={{
          icon: StarIcon,
          title: 'No tours found.',
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
              value={filters.status ?? 'all'}
              onValueChange={(v) =>
                onFilterChange(
                  'status',
                  v === 'all' ? undefined : (v as TripStatus),
                )
              }
            >
              <SelectTrigger className='w-32 shrink-0'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='DRAFT'>Draft</SelectItem>
                <SelectItem value='LIVE'>Live</SelectItem>
                <SelectItem value='PAUSED'>Paused</SelectItem>
                <SelectItem value='ARCHIVED'>Archived</SelectItem>
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
            <DataTableActions>
              <DataTableViewOptions table={table} />
            </DataTableActions>
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
