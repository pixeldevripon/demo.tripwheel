'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerFieldProps {
  /** Value as a `yyyy-MM-dd` string ('' when unset). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
}

/**
 * Shared dashboard date picker (shadcn Calendar in a Popover). Reads/writes a
 * `yyyy-MM-dd` string so it drops into form state and API payloads unchanged.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = 'Pick a date',
  clearable = false,
  disabled = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {/* Styled like the Select/Input triggers beside it in toolbars and
            forms: h-10, raised surface, rounded, quiet border + focus ring. */}
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-surface-raised px-3 py-2 text-left text-sm shadow-xs',
            'transition-[color,border-color,box-shadow] duration-normal outline-none hover:not-disabled:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25',
            disabled && 'cursor-not-allowed opacity-60',
            !selectedDate && 'text-content-subtle',
          )}
        >
          <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
          </span>
          {clearable && selectedDate && (
            // A real interactive wrapper: the icon component does not forward
            // events, and the trigger reacts on pointerdown - both must be
            // intercepted or the click just toggles the calendar.
            <span
              role="button"
              aria-label="Clear date"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="inline-flex shrink-0 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          captionLayout="dropdown"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
