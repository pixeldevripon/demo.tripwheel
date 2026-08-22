'use client';

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Dialog as SheetPrimitive } from 'radix-ui';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
    return <SheetPrimitive.Root data-slot='sheet' {...props} />;
}

function SheetTrigger({
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
    return <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props} />;
}

function SheetClose({
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
    return <SheetPrimitive.Close data-slot='sheet-close' {...props} />;
}

function SheetPortal({
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
    return <SheetPrimitive.Portal data-slot='sheet-portal' {...props} />;
}

function SheetOverlay({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
    return (
        <SheetPrimitive.Overlay
            data-slot='sheet-overlay'
            className={cn(
                'fixed inset-0 z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
                className
            )}
            {...props}
        />
    );
}

function SheetContent({
    className,
    children,
    side = 'right',
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: 'top' | 'right' | 'bottom' | 'left';
    showCloseButton?: boolean;
}) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
                data-slot='sheet-content'
                data-side={side}
                className={cn(
                    'fixed z-50 flex flex-col bg-popover bg-clip-padding text-sm text-popover-foreground shadow-md transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-4xl data-[side=right]:sm:max-w-4xl data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10',
                    className
                )}
                {...props}>
                {children}
                {showCloseButton && (
                    <SheetPrimitive.Close data-slot='sheet-close' asChild>
                        <Button
                            variant='ghost'
                            className='absolute top-4 right-4 bg-secondary'
                            size='icon-sm'>
                            <HugeiconsIcon icon={Cancel01Icon} />
                            <span className='sr-only'>Close</span>
                        </Button>
                    </SheetPrimitive.Close>
                )}
            </SheetPrimitive.Content>
        </SheetPortal>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='sheet-header'
            className={cn('flex flex-col gap-1.5 p-8', className)}
            {...props}
        />
    );
}

/**
 * The scrolling body of a sheet.
 *
 * Exists so content lines up with the header. Every sheet used to hand-roll
 * this div and every one of them reached for `px-4`, against a header and
 * footer that are `p-8` - so the title sat 16px further in than the content
 * beneath it, on ten different screens (reported 2026-08-02). The inset is a
 * property of the sheet, not of whatever happens to be inside it, so it lives
 * here with the other two.
 *
 * Only the HORIZONTAL padding is fixed. Vertical rhythm is the caller's:
 * detail sheets divide their own `Section`s (which carry `py-4`), forms want a
 * gap. Pass it in `className`.
 */
function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='sheet-body'
            className={cn('min-h-0 flex-1 overflow-y-auto px-8', className)}
            {...props}
        />
    );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='sheet-footer'
            className={cn('mt-auto flex flex-col gap-2 p-8', className)}
            {...props}
        />
    );
}

function SheetTitle({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
    return (
        <SheetPrimitive.Title
            data-slot='sheet-title'
            className={cn('text-lg font-medium text-foreground', className)}
            {...props}
        />
    );
}

function SheetDescription({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
    return (
        <SheetPrimitive.Description
            data-slot='sheet-description'
            className={cn(
                'mt-0.5 text-sm leading-relaxed text-muted-foreground',
                className
            )}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
};

