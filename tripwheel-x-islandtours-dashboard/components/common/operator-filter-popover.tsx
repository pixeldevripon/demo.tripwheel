'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

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
import { useOperatorSearch } from '@/hooks/operators/use-operators';
import type { OperatorSearchItem } from '@/lib/api/operators';

interface OperatorFilterPopoverProps {
  value: string | undefined;
  onChange: (operatorId: string | undefined) => void;
  /** Island cascade (client review #10): only operators with >=1 active
   *  tour on this island appear. */
  destinationId?: string;
}

function getDisplayName(op: OperatorSearchItem): string {
  return op.companyInfo?.companyName ?? op.user.name;
}

export function OperatorFilterPopover({
  value,
  onChange,
  destinationId,
}: OperatorFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // The label must survive the search results changing (or never loading -
  // the query only runs while the popover is open), so the picked name is
  // remembered here rather than re-derived from the current result page.
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data, isFetching } = useOperatorSearch(q, open, destinationId);
  const operators = data?.data ?? [];

  const selected = value ? operators.find((op) => op.id === value) : undefined;
  const label = value
    ? (selected ? getDisplayName(selected) : (selectedName ?? '1 operator'))
    : 'All operators';

  function handleSelect(op: OperatorSearchItem) {
    const next = op.id === value ? undefined : op.id;
    onChange(next);
    setSelectedName(next ? getDisplayName(op) : null);
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
      {/* align=end + collision padding: these filters sit at the right edge of
          the toolbar, where a start-aligned 18rem panel runs off screen. */}
      <PopoverContent className="w-72 p-0" align="end" collisionPadding={12}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search operators..."
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {isFetching && operators.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Searching...</div>
            ) : (
              <>
                <CommandEmpty>No operators found.</CommandEmpty>
                <CommandGroup>
                  {operators.map((op) => (
                    <CommandItem
                      key={op.id}
                      value={op.id}
                      onSelect={() => handleSelect(op)}
                      // Match the Select dropdowns' highlight (accent, not muted).
                      className="flex items-start gap-2 data-selected:bg-accent data-selected:text-accent-foreground"
                    >
                      <HugeiconsIcon icon={Tick02Icon}
                        className={`size-3.5 mt-0.5 shrink-0 ${
                          value === op.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{getDisplayName(op)}</p>
                        <p className="text-xs text-muted-foreground truncate">{op.user.email}</p>
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
