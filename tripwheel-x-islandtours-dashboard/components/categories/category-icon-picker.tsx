'use client';

import { createElement, useMemo, useState } from 'react';
import { ChevronsUpDownIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CATEGORY_ICON_NAMES, getCategoryIconComponent } from '@/lib/constants/category-icons';

export { CATEGORY_ICON_NAMES };

function LucideByName({ name, className }: { name: string; className?: string }) {
  // Stable module-level lookup (CATEGORY_ICON_COMPONENTS), not a render-created
  // component. createElement avoids the static-components false positive that the
  // JSX `<Cmp/>` form trips.
  return createElement(getCategoryIconComponent(name), { className });
}

interface CategoryIconPickerProps {
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  disabled?: boolean;
}

export function CategoryIconPicker({ value, onChange, disabled }: CategoryIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORY_ICON_NAMES as readonly string[];
    return (CATEGORY_ICON_NAMES as readonly string[]).filter(n =>
      n.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 min-w-0">
              {value ? (
                <LucideByName name={value} className="size-4 shrink-0" />
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {value || 'Select an icon…'}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-3 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-2" align="start">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="mb-2 h-8"
          />
          <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto">
            {filtered.map(name => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md border transition-colors hover:bg-muted',
                  value === name ? 'border-foreground bg-muted' : 'border-transparent',
                )}
              >
                <LucideByName name={name} className="size-6" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 py-6 text-center text-xs text-muted-foreground">
                No icons found.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(null)}
          title="Clear icon"
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
