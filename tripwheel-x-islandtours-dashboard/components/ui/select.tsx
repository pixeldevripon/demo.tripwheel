'use client';

import {
    ArrowDown01Icon,
    ArrowUp01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Select as SelectPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Radix Select, with one behaviour patched out.
 *
 * ## Why `onValueChange('')` is swallowed
 *
 * Radix mirrors the select's value into a hidden native `<select>` so the
 * control works inside a plain HTML form. That mirror is UNCONTROLLED
 * (`defaultValue`), so Radix keeps it in sync imperatively: whenever the value
 * changes it assigns `select.value = next` and dispatches a REAL `change` event,
 * which React routes straight back into `onValueChange`.
 *
 * Its `<option>` list is built from the items, and each item registers itself
 * from an effect. So there is a window - right after mount - where the mirror
 * has no options at all. Assigning an unknown value to an option-less
 * `<select>` does not throw; the DOM silently coerces it to `''`. Radix then
 * dispatches that `''` back as if the user had chosen it, and the real value is
 * gone.
 *
 * That window is not theoretical: any form that renders a skeleton until its
 * data arrives (`if (isLoading) return <Skeleton />`) mounts its selects in the
 * very commit that also calls `reset(data)`, which is exactly the collision.
 * It cost the AI Translation provider field: it rendered blank on load and then
 * SAVED the blank over the stored provider, with a "Settings saved" toast.
 *
 * `''` is safe to drop unconditionally because Radix itself throws if a
 * `SelectItem` has `value=""` - so no user choice can ever produce it, and any
 * `''` arriving here is the mirror echoing its own inability to hold the value.
 * The mirror stays stale until the next real change, which affects nothing: the
 * dashboard reads every select through React state, never through native form
 * submission.
 *
 * Keep this wrapper if `select.tsx` is ever re-generated from shadcn.
 */
function Select({
    onValueChange,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
    return (
        <SelectPrimitive.Root
            data-slot='select'
            onValueChange={next => {
                if (next === '') return;
                onValueChange?.(next);
            }}
            {...props}
        />
    );
}

function SelectGroup({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
    return (
        <SelectPrimitive.Group
            data-slot='select-group'
            className={cn('scroll-my-1.5 p-1.5', className)}
            {...props}
        />
    );
}

function SelectValue({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot='select-value' {...props} />;
}

function SelectTrigger({
    className,
    size = 'default',
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: 'sm' | 'default';
}) {
    return (
        <SelectPrimitive.Trigger
            data-slot='select-trigger'
            data-size={size}
            className={cn(
                "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-surface-raised shadow-xs px-3 py-2 text-sm whitespace-nowrap transition-[color,border-color,box-shadow] duration-normal outline-none hover:not-disabled:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-solid data-placeholder:text-content-subtle data-[size=default]:h-10 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-danger-border [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
                className
            )}
            {...props}>
            {children}
            <SelectPrimitive.Icon asChild>
                <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className='pointer-events-none size-3.5 text-muted-foreground'
                />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    position = 'item-aligned',
    align = 'center',
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot='select-content'
                data-align-trigger={position === 'item-aligned'}
                className={cn(
                    'relative z-50 max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-sm bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                    position === 'popper' &&
                        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                    className
                )}
                position={position}
                align={align}
                {...props}>
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                    data-position={position}
                    className={cn(
                        'data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)',
                        position === 'popper' && ''
                    )}>
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

function SelectLabel({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            data-slot='select-label'
            className={cn(
                'px-3 py-2 text-2xs font-medium tracking-caps text-muted-foreground uppercase',
                className
            )}
            {...props}
        />
    );
}

function SelectItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot='select-item'
            className={cn(
                "relative flex w-full cursor-default items-center gap-2.5 rounded-sm py-2 pr-8 pl-3 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
                className
            )}
            {...props}>
            <span className='pointer-events-none absolute right-2 flex size-4 items-center justify-center'>
                <SelectPrimitive.ItemIndicator>
                    <HugeiconsIcon
                        icon={Tick02Icon}
                        className='pointer-events-none'
                    />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

function SelectSeparator({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            data-slot='select-separator'
            className={cn(
                'pointer-events-none -mx-1.5 my-1.5 h-px bg-border/50',
                className
            )}
            {...props}
        />
    );
}

function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            data-slot='select-scroll-up-button'
            className={cn(
                "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-3.5",
                className
            )}
            {...props}>
            <HugeiconsIcon icon={ArrowUp01Icon} />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            data-slot='select-scroll-down-button'
            className={cn(
                "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-3.5",
                className
            )}
            {...props}>
            <HugeiconsIcon icon={ArrowDown01Icon} />
        </SelectPrimitive.ScrollDownButton>
    );
}

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
};

