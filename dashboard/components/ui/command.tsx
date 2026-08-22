'use client';

import { Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Command as CommandPrimitive } from 'cmdk';
import * as React from 'react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot='command'
            className={cn(
                'flex size-full flex-col overflow-hidden bg-popover text-popover-foreground',
                className
            )}
            {...props}
        />
    );
}

function CommandDialog({
    title = 'Command Palette',
    description = 'Search for a command to run...',
    children,
    className,
    showCloseButton = false,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string;
    description?: string;
    className?: string;
    showCloseButton?: boolean;
}) {
    return (
        <Dialog {...props}>
            <DialogHeader className='sr-only'>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {/* No `top-*` / `translate-y-*` override here: `DialogContent` is
                already centred (`top-1/2 -translate-y-1/2`) and this must stay
                centred at every viewport size.

                It used to carry `top-1/3 translate-y-0`, which cancelled only the
                VERTICAL half of that centring - so the palette stayed centred
                horizontally while its top edge was pinned a third of the way down
                and it grew downwards from there. On a short viewport that ran it
                off the bottom of the screen.

                Height is safe to centre because `CommandList` caps itself at
                `min(28rem, 55dvh)`, so the panel can never be taller than the
                viewport no matter how many results match. */}
            <DialogContent
                className={cn('overflow-hidden p-0', className)}
                showCloseButton={showCloseButton}>
                {children}
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div data-slot='command-input-wrapper' className='p-1'>
            <InputGroup className='border-transparent border-b-input bg-transparent px-3'>
                <CommandPrimitive.Input
                    data-slot='command-input'
                    className={cn(
                        'w-full px-2 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
                        className
                    )}
                    {...props}
                />
                <InputGroupAddon>
                    <HugeiconsIcon
                        icon={Search01Icon}
                        className='size-3.5 shrink-0 opacity-50'
                    />
                </InputGroupAddon>
            </InputGroup>
        </div>
    );
}

function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot='command-list'
            className={cn(
                // `dvh`, not `vh`: on mobile browsers `vh` measures the viewport
                // WITH the URL bar expanded, so 55vh can exceed what is actually
                // visible - and since the dialog is centred, that overflows both
                // edges at once. `dvh` tracks the live visible height.
                'no-scrollbar max-h-[min(28rem,55dvh)] scroll-py-1 overflow-x-hidden overflow-y-auto outline-none',
                className
            )}
            {...props}
        />
    );
}

function CommandEmpty({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            data-slot='command-empty'
            className={cn('py-6 text-center text-sm', className)}
            {...props}
        />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot='command-group'
            className={cn(
                'overflow-hidden p-1.5 text-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-2xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-caps **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase',
                className
            )}
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot='command-separator'
            className={cn('-mx-1.5 my-1.5 h-px bg-border/50', className)}
            {...props}
        />
    );
}

function CommandItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot='command-item'
            className={cn(
                "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-3 py-2 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-sm data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 data-selected:*:[svg]:text-foreground",
                className
            )}
            {...props}>
            {children}
            <HugeiconsIcon
                icon={Tick02Icon}
                className='ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100'
            />
        </CommandPrimitive.Item>
    );
}

function CommandShortcut({
    className,
    ...props
}: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot='command-shortcut'
            className={cn(
                'ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground',
                className
            )}
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
};

