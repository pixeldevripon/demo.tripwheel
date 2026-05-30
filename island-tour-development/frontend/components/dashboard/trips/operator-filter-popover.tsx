'use client';

import { useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon, UserIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

function getDisplayName(op: OperatorSearchItem): string {
  return op.companyInfo?.companyName ?? op.user.name;
}

export function OperatorFilterPopover({ value, onChange }: OperatorFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const { data, isFetching } = useOperatorSearch(q, open);
  const operators = data?.data ?? [];

  const selected = value ? operators.find((op) => op.id === value) : undefined;

  function handleSelect(op: OperatorSearchItem) {
    onChange(op.id === value ? undefined : op.id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 max-w-52 justify-between"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs">
              {selected ? getDisplayName(selected) : 'All operators'}
            </span>
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            {value && (
              <XIcon
                className="size-3 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
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
                      className="flex items-start gap-2"
                    >
                      <CheckIcon
                        className={`size-3.5 mt-0.5 shrink-0 ${
                          value === op.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{getDisplayName(op)}</p>
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
