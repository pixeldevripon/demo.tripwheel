'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronsUpDownIcon, StarIcon, XIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface MultiSelectOption {
    value: string;
    label: string;
    /** Optional muted second line shown in the dropdown (e.g. performance summary). */
    description?: string;
    /** Optional trailing node shown next to the label in the dropdown (e.g. a badge). */
    badge?: ReactNode;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    /** When provided, each selected chip exposes a "set primary" star (used by Trip categories). */
    primaryValue?: string | null;
    onPrimaryChange?: (value: string) => void;
}

/**
 * Reusable searchable multi-select built on Popover + cmdk Command + Badge.
 * Controlled: owns no value state. Optionally marks one selected item as "primary".
 */
export function MultiSelect({
    options,
    value,
    onChange,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No options found.',
    disabled,
    className,
    primaryValue,
    onPrimaryChange,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);

    const selectedOptions = value
        .map(v => options.find(o => o.value === v))
        .filter((o): o is MultiSelectOption => Boolean(o));

    function toggle(v: string) {
        onChange(
            value.includes(v) ? value.filter(x => x !== v) : [...value, v]
        );
    }

    function remove(e: React.MouseEvent, v: string) {
        e.stopPropagation();
        onChange(value.filter(x => x !== v));
    }

    function setPrimary(e: React.MouseEvent, v: string) {
        e.stopPropagation();
        onPrimaryChange?.(v);
    }

    return (
        <div className={cn('space-y-2', className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={disabled}
                        className='h-9 w-full justify-between font-normal'>
                        <span className='truncate text-xs text-muted-foreground'>
                            {value.length > 0
                                ? `${value.length} selected`
                                : placeholder}
                        </span>
                        <ChevronsUpDownIcon className='size-3 shrink-0 text-muted-foreground' />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className='w-(--radix-popover-trigger-width) p-0'
                    align='start'>
                    <Command>
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandList>
                            <CommandEmpty>{emptyText}</CommandEmpty>
                            <CommandGroup>
                                {options.map(opt => {
                                    const checked = value.includes(opt.value);
                                    return (
                                        <CommandItem
                                            key={opt.value}
                                            value={opt.label}
                                            onSelect={() => toggle(opt.value)}
                                            className='flex items-start gap-2'>
                                            <CheckIcon
                                                className={cn(
                                                    'mt-0.5 size-3.5 shrink-0',
                                                    checked
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                )}
                                            />
                                            <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                                                <span className='flex items-center gap-2'>
                                                    <span className='truncate text-sm'>
                                                        {opt.label}
                                                    </span>
                                                    {opt.badge}
                                                </span>
                                                {opt.description && (
                                                    <span className='truncate text-xs text-muted-foreground'>
                                                        {opt.description}
                                                    </span>
                                                )}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedOptions.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                    {selectedOptions.map(opt => {
                        const isPrimary = primaryValue === opt.value;
                        return (
                            <Badge
                                key={opt.value}
                                variant='secondary'
                                className='gap-1 rounded-md border border-border bg-muted px-2 py-1 text-foreground normal-case tracking-normal'>
                                {onPrimaryChange && (
                                    <button
                                        type='button'
                                        onClick={e => setPrimary(e, opt.value)}
                                        title={
                                            isPrimary
                                                ? 'Primary'
                                                : 'Set as primary'
                                        }
                                        className='shrink-0'>
                                        <StarIcon
                                            className={cn(
                                                'size-3',
                                                isPrimary
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        />
                                    </button>
                                )}
                                <span className='truncate text-xs font-medium'>
                                    {opt.label}
                                </span>
                                {!disabled && (
                                    <button
                                        type='button'
                                        onClick={e => remove(e, opt.value)}
                                        aria-label={`Remove ${opt.label}`}
                                        className='shrink-0'>
                                        <XIcon className='size-3 text-muted-foreground hover:text-foreground' />
                                    </button>
                                )}
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

