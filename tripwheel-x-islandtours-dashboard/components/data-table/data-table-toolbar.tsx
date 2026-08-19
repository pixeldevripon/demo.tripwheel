'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { Input } from '@/components/ui/input';

/**
 * Toolbar primitives (05 §7). Compose inside DataTable's `toolbar` slot:
 * search grows, module filters sit beside it, actions right-align.
 */

export function DataTableSearch({
    value,
    onChange,
    placeholder = 'Search…',
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <div className='relative min-w-36 flex-1'>
            <HugeiconsIcon icon={Search01Icon} className='absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground' />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className='pl-8'
                aria-label={placeholder}
            />
        </div>
    );
}

/** Right-aligned action cluster; wraps to its own row on very narrow screens. */
export function DataTableActions({ children }: { children: React.ReactNode }) {
    return (
        <div className='ml-auto flex items-center gap-2 max-[400px]:ml-0 max-[400px]:w-full max-[400px]:justify-end'>
            {children}
        </div>
    );
}
