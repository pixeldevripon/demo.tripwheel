'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, XIcon } from 'lucide-react';
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
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center gap-2 border border-input bg-transparent px-3 text-sm text-left',
            'hover:bg-muted/50 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed',
            !selectedDate && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
          </span>
          {clearable && selectedDate && (
            <XIcon
              className="size-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            />
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
