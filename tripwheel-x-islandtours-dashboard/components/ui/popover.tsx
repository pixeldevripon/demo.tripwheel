'use client';

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Popover as PopoverPrimitive } from 'radix-ui';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Popover({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

function PopoverContent({
    className,
    align = 'center',
    sideOffset = 4,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot='popover-content'
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    // `relative` is the containing block PopoverCloseButton
                    // pins its X to - without it the X would anchor to
                    // Radix's popper wrapper instead of this card.
                    'relative z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-4 rounded-lg bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                    className
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}

function PopoverAnchor({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
    return <PopoverPrimitive.Anchor data-slot='popover-anchor' {...props} />;
}

function PopoverClose({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
    return <PopoverPrimitive.Close data-slot='popover-close' {...props} />;
}

/**
 * The way out of a panel that opens over the grid - the dialog's X, same
 * shape and same corner, so a popover is dismissed the way the "Close a
 * range" modal already is (pastel 9).
 *
 * It exists because a panel whose only button ALSO does something is a
 * trap: on the departure card that button stopped sales. Dismissal now has
 * its own control and never shares one with an action.
 *
 * Requires a Popover root ancestor (it is `Popover.Close`), and a `relative`
 * container - PopoverContent is one.
 */
function PopoverCloseButton({
    className,
    ...props
}: React.ComponentProps<typeof Button>) {
    return (
        <PopoverPrimitive.Close data-slot='popover-close' asChild>
            <Button
                variant='ghost'
                size='icon-sm'
                // 32px, not the dialog's 36: these cards are w-72/w-80, and
                // the size matches the h-8 actions they already carry. With
                // right-2.5 the X owns the panel's right 42px - what the
                // headers below it pad against.
                className={cn(
                    'absolute top-2.5 right-2.5 z-10 size-8 bg-secondary',
                    className
                )}
                {...props}>
                <HugeiconsIcon icon={Cancel01Icon} />
                <span className='sr-only'>Close this panel</span>
            </Button>
        </PopoverPrimitive.Close>
    );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='popover-header'
            className={cn('flex flex-col gap-1 text-sm', className)}
            {...props}
        />
    );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
    return (
        <div
            data-slot='popover-title'
            className={cn(
                'text-2xs font-medium tracking-caps uppercase',
                className
            )}
            {...props}
        />
    );
}

function PopoverDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot='popover-description'
            className={cn(
                'mt-0.5 text-sm leading-relaxed text-muted-foreground',
                className
            )}
            {...props}
        />
    );
}

export {
    Popover,
    PopoverAnchor,
    PopoverClose,
    PopoverCloseButton,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
};

