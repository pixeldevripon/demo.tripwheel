'use client';

import {
    Cancel01Icon,
    StarIcon,
    Tick02Icon,
    UnfoldMoreIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

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
                        className='h-10 w-full justify-between px-3 font-light'>
                        <span
                            className={cn(
                                'truncate text-sm',
                                value.length > 0
                                    ? 'text-content'
                                    : 'text-content-subtle'
                            )}>
                            {value.length > 0
                                ? `${value.length} selected`
                                : placeholder}
                        </span>
                        <HugeiconsIcon
                            icon={UnfoldMoreIcon}
                            className='size-4 shrink-0 text-content-subtle'
                        />
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
                                            <HugeiconsIcon
                                                icon={Tick02Icon}
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
                                className={cn(
                                    'gap-1 rounded-md border px-2 py-1 normal-case tracking-normal',
                                    // The primary chip must read as primary at a glance, not
                                    // only via the star (which used to point at a `rating`
                                    // token that never existed and rendered gray-on-gray).
                                    isPrimary
                                        ? 'border-primary-subtle-content/25 bg-primary-subtle text-primary-subtle-content'
                                        : 'border-border bg-muted text-foreground'
                                )}>
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
                                        <HugeiconsIcon
                                            icon={StarIcon}
                                            className={cn(
                                                'size-3 transition-colors duration-fast',
                                                isPrimary
                                                    ? 'fill-warning-solid text-warning-solid'
                                                    : 'text-content-subtle hover:text-warning-solid'
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
                                        <HugeiconsIcon
                                            icon={Cancel01Icon}
                                            className='size-3 text-muted-foreground hover:text-foreground'
                                        />
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

