'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

import { useState } from 'react';

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
import { useRefOptions } from '@/hooks/recommendations/use-recommendation-refs';
import {
    RECOMMENDATION_REF_TYPE_LABELS,
    type RecommendationRefType,
} from '@/types/recommendation';

interface RecommendationRefPickerProps {
    refType: RecommendationRefType;
    /** The selected entity's id, or empty. */
    value: string;
    /**
     * The name to show for the current value when it is not in the freshly
     * fetched options (e.g. an edit that opens before the list loads). On edit
     * this is seeded from the row's resolved `refLabel`.
     */
    currentLabel?: string;
    onChange: (id: string, name: string) => void;
    invalid?: boolean;
}

/**
 * Searchable picker for the entity an INTERNAL recommendation points at.
 *
 * The options are scoped to the chosen `refType` and fetched only while the
 * popover is open. The command filters client-side over one page of results.
 */
export function RecommendationRefPicker({
    refType,
    value,
    currentLabel,
    onChange,
    invalid,
}: RecommendationRefPickerProps) {
    const [open, setOpen] = useState(false);
    const { options, isLoading } = useRefOptions(refType, open);

    const selected = value ? options.find((o) => o.id === value) : undefined;
    const label =
        selected?.name ??
        (value ? (currentLabel ?? '1 selected') : `Select a ${RECOMMENDATION_REF_TYPE_LABELS[refType].toLowerCase()}...`);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type='button'
                    aria-invalid={invalid}
                    className='flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface-raised px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,border-color,box-shadow] duration-normal outline-none hover:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25 aria-invalid:border-danger-border aria-invalid:ring-danger-border/20'>
                    <span
                        className={`truncate ${value ? '' : 'text-muted-foreground'}`}>
                        {label}
                    </span>
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className='size-3.5 shrink-0 text-muted-foreground'
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className='w-(--radix-popover-trigger-width) p-0'
                align='start'
                collisionPadding={12}>
                <Command>
                    <CommandInput
                        placeholder={`Search ${RECOMMENDATION_REF_TYPE_LABELS[refType].toLowerCase()}s...`}
                    />
                    <CommandList>
                        {isLoading ? (
                            <div className='py-6 text-center text-xs text-muted-foreground'>
                                Loading...
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>Nothing found.</CommandEmpty>
                                <CommandGroup>
                                    {options.map((o) => (
                                        <CommandItem
                                            key={o.id}
                                            value={`${o.name} ${o.id}`}
                                            onSelect={() => {
                                                onChange(o.id, o.name);
                                                setOpen(false);
                                            }}
                                            className='flex items-center gap-2 data-selected:bg-accent data-selected:text-accent-foreground'>
                                            <HugeiconsIcon
                                                icon={Tick02Icon}
                                                className={`size-3.5 shrink-0 ${
                                                    value === o.id
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                }`}
                                            />
                                            <span className='truncate'>
                                                {o.name}
                                            </span>
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
