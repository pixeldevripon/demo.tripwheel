'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TableSearchInputProps {
  /** The committed (debounced) value the table filters on. */
  value: string;
  /** Called with the debounced value once typing pauses. */
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Debounce delay in ms before propagating to onValueChange. */
  delay?: number;
  /**
   * Extra wrapper classes. Width is standardized (`min-w-36 flex-1`, matching
   * DataTableSearch) so every table's search bar reads identically - do not
   * override it per screen.
   */
  className?: string;
}

/**
 * Search box for dashboard list tables. Keeps its own instant local state so
 * every keystroke paints immediately, and only propagates the value to the
 * (expensive) table filter after `delay` ms of inactivity. Binding an Input
 * straight to TanStack Table's `globalFilter` re-runs the row models and
 * re-renders every row on each keystroke, which feels laggy — this decouples
 * the two.
 */
export function TableSearchInput({
  value,
  onValueChange,
  placeholder = 'Search...',
  delay = 500,
  className,
}: TableSearchInputProps) {
  const [local, setLocal] = useState(value);
  // Track the last value we emitted so an external reset (e.g. clearing the
  // filter) syncs back into the input without clobbering in-flight typing.
  const emitted = useRef(value);

  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setLocal(value);
    }
  }, [value]);

  useEffect(() => {
    if (local === emitted.current) return;
    const timer = setTimeout(() => {
      emitted.current = local;
      onValueChange(local);
    }, delay);
    return () => clearTimeout(timer);
  }, [local, delay, onValueChange]);

  return (
    <div className={cn('relative min-w-36 flex-1', className)}>
      <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
