'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * On/off toggle. Same prop shape as `Checkbox` (`checked` +
 * `onCheckedChange`), so the two are interchangeable at a call site.
 *
 * Reach for this over a checkbox when the control takes effect on its own -
 * "is this email switched on" - rather than selecting an item in a set. A
 * checkbox reads as "tick to include"; a switch reads as "this is running".
 */
function Switch({
    className,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot='switch'
            className={cn(
                'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none',
                'bg-input data-checked:bg-primary',
                'focus-visible:ring-2 focus-visible:ring-ring/30',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}>
            <SwitchPrimitive.Thumb
                data-slot='switch-thumb'
                className={cn(
                    'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
                    'translate-x-0.5 data-checked:translate-x-4.5',
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
