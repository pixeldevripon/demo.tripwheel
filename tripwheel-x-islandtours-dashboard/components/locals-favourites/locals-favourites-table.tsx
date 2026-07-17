'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  SearchIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Settings2Icon,
  StarIcon,
  Loader2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { makeTripColumns } from '@/components/trips/trip-columns';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OperatorFilterPopover } from '@/components/trips/operator-filter-popover';
import { useSetLocalsFavourite } from '@/hooks/locals-favourites/use-locals-favourites';
import { useSession } from '@/lib/auth-client';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
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
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

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
}: LocalsFavouritesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [operatorFilter, setOperatorFilter] = useState<string | undefined>(undefined);
  const [favFilter, setFavFilter] = useState<string>('all');
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

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit);

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    onFilterChange('status', value === 'all' ? undefined : (value as TripStatus));
  }

  function handleDestinationFilterChange(value: string) {
    setDestinationFilter(value);
    onFilterChange('destinationId', value === 'all' ? undefined : value);
  }

  function handleOperatorFilterChange(value: string | undefined) {
    setOperatorFilter(value);
    onFilterChange('operatorId', value);
  }

  function handleFavFilterChange(value: string) {
    setFavFilter(value);
    onFilterChange('isLocalsFavourite', value === 'all' ? undefined : value);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-36">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tours..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={favFilter} onValueChange={handleFavFilterChange}>
          <SelectTrigger className="w-40 shrink-0">
            <SelectValue placeholder="Favourite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tours</SelectItem>
            <SelectItem value="true">Locals&apos; favourites</SelectItem>
            <SelectItem value="false">Not favourited</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-32 shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="LIVE">Live</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={destinationFilter} onValueChange={handleDestinationFilterChange}>
          <SelectTrigger className="w-44 shrink-0">
            <SelectValue placeholder="Destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Destinations</SelectItem>
            {(destinations ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <OperatorFilterPopover value={operatorFilter} onChange={handleOperatorFilterChange} />

        <div className="flex items-center gap-2 ml-auto max-[400px]:w-full max-[400px]:ml-0 max-[400px]:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2Icon />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-none ring-1 ring-foreground/5 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.getSize() !== 150 ? header.getSize() : undefined,
                    }}
                    className="text-xs font-semibold"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MapPinIcon className="size-8 opacity-40" />
                    <p className="text-sm">No tours found.</p>
                    <p className="text-xs">No tours match the current filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.original.isLocalsFavourite ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows per page</span>
          <Select value={String(limit)} onValueChange={(val) => onLimitChange(Number(val))}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            Page {page} of {totalPages || 1}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={page <= 1}>
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>

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
    </div>
  );
}
