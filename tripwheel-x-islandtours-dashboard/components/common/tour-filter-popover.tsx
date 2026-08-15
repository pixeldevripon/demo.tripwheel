'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRole } from '@/contexts/role-context';
import { useAdminTrips, useMyTrips } from '@/hooks/trips/use-trips';
import type { TripListItem } from '@/types/trip';

interface TourFilterPopoverProps {
  value: string | undefined;
  onChange: (tourId: string | undefined) => void;
  /** Cascade narrowing (client review #10): Island narrows Operator,
   *  Operator narrows Tour. Both are pure filters on the search query. */
  operatorId?: string;
  destinationId?: string;
}

/**
 * "Filter by trip" popover - the OperatorFilterPopover idiom pointed at tours.
 * Role-aware: an admin searches every tour, an operator only their own (the
 * same split as the Trips list). Queries run only while the popover is open.
 */
export function TourFilterPopover({
  value,
  onChange,
  operatorId,
  destinationId,
}: TourFilterPopoverProps) {
  const { role } = useRole();
  const isAdmin = role === 'ADMIN';

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Remembered so the trigger label survives the search results changing (the
  // query only runs while the popover is open).
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const params = {
    limit: 20,
    ...(q ? { search: q } : {}),
    // operatorId exists only on the admin list query - my-trips would 400 on
    // the unknown param (global ValidationPipe forbids non-whitelisted keys).
    ...(isAdmin && operatorId ? { operatorId } : {}),
    ...(destinationId ? { destinationId } : {}),
  };
  const adminQuery = useAdminTrips(params, open && isAdmin);
  const operatorQuery = useMyTrips(params, open && !isAdmin);
  const { data, isFetching } = isAdmin ? adminQuery : operatorQuery;
  const tours = data?.data ?? [];

  const selected = value ? tours.find((t) => t.id === value) : undefined;
  // "Tours", the platform word, everywhere a traveller-facing noun leaks into
  // operator chrome (MCK-16 change 11, review F16) - "trips" was the odd one
  // out against the nav, the agenda and the public site.
  const label = value
    ? (selected?.name ?? selectedName ?? '1 tour')
    : 'All tours';

  function handleSelect(tour: TripListItem) {
    const next = tour.id === value ? undefined : tour.id;
    onChange(next);
    setSelectedName(next ? tour.name : null);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedName(null);
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Styled as a SelectTrigger clone (height, surface, border, shadow,
            chevron) so it is indistinguishable from the dropdowns beside it. */}
        <button
          type="button"
          className="flex h-10 min-w-44 max-w-60 shrink-0 items-center justify-between gap-2 rounded-md border border-input bg-surface-raised px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,border-color,box-shadow] duration-normal outline-none hover:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25"
        >
          <span className="truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value && (
              // A real interactive wrapper: the icon component does not
              // forward events, and the trigger reacts on pointerdown - both
              // must be intercepted or the click just toggles the popover.
              <span
                role="button"
                aria-label="Clear filter"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleClear}
                className="inline-flex text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </span>
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 text-muted-foreground"
            />
          </span>
        </button>
      </PopoverTrigger>
      {/* align=end + collision padding: this filter sits at the right edge of
          the toolbar, where a start-aligned 18rem panel runs off screen. */}
      <PopoverContent className="w-72 p-0" align="end" collisionPadding={12}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search trips..."
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {isFetching && tours.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Searching...
              </div>
            ) : (
              <>
                <CommandEmpty>No trips found.</CommandEmpty>
                <CommandGroup>
                  {tours.map((tour) => (
                    <CommandItem
                      key={tour.id}
                      value={tour.id}
                      onSelect={() => handleSelect(tour)}
                      // Match the Select dropdowns' highlight (accent, not muted).
                      className="flex items-start gap-2 data-selected:bg-accent data-selected:text-accent-foreground"
                    >
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className={`size-3.5 mt-0.5 shrink-0 ${
                          value === tour.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{tour.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tour.destinationName ?? tour.slug}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
