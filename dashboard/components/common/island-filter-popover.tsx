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
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';

interface IslandFilterPopoverProps {
  value: string | undefined;
  onChange: (destinationId: string | undefined) => void;
}

/**
 * "Filter by island" - the top of the admin calendar's cascade (client
 * review #10): Island narrows Operator, Operator narrows Tour. The
 * OperatorFilterPopover idiom without the search input - the platform has a
 * handful of islands, so a list beats a search box.
 */
export function IslandFilterPopover({
  value,
  onChange,
}: IslandFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: destinations, isLoading } = useActiveDestinations();
  const islands = destinations ?? [];

  const selected = value ? islands.find((d) => d.id === value) : undefined;
  const label = value ? (selected?.name ?? '1 island') : 'All islands';

  function handleSelect(id: string) {
    onChange(id === value ? undefined : id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Styled as a SelectTrigger clone, indistinguishable from the
            Operator and Tour filters beside it. */}
        <button
          type="button"
          className="flex h-10 min-w-44 max-w-60 shrink-0 items-center justify-between gap-2 rounded-md border border-input bg-surface-raised px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,border-color,box-shadow] duration-normal outline-none hover:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25"
        >
          <span className="truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value && (
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
      <PopoverContent className="w-72 p-0" align="end" collisionPadding={12}>
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && islands.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>No islands found.</CommandEmpty>
                <CommandGroup>
                  {islands.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.id}
                      onSelect={() => handleSelect(d.id)}
                      className="flex items-center gap-2 data-selected:bg-accent data-selected:text-accent-foreground"
                    >
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className={`size-3.5 shrink-0 ${
                          value === d.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span className="truncate text-sm">{d.name}</span>
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
