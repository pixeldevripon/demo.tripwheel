'use client';

import { CloudUploadIcon, ImageAdd02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The empty state every media picker opens with.
 *
 * Extracted from ImageSelectorField because the video picker had hand-rolled a
 * flatter, smaller version of the same thing - two empty states for the same
 * job, and the video one read as an unstyled box next to it in a dialog. The
 * only thing that legitimately differs per kind is the icon and the copy, so
 * those are props and everything else is shared.
 *
 * `compact` is the secondary state used once a multi-image field already has
 * images: same affordance, less vertical weight.
 */
export function MediaUploadZone({
    onClick,
    disabled,
    label,
    hint,
    compact = false,
    icon,
    compactIcon,
}: {
    onClick: () => void;
    disabled?: boolean;
    label: string;
    hint?: string;
    compact?: boolean;
    /** Full-size icon. Defaults to the upload cloud. */
    icon?: IconSvgElement;
    /** Compact icon. Defaults to the add-image glyph. */
    compactIcon?: IconSvgElement;
}) {
    return (
        <div
            role='button'
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onClick}
            onKeyDown={e => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                'group w-full flex flex-col items-center justify-center border border-dashed border-border',
                'transition-all duration-200 hover:border-primary/60 hover:bg-primary/2',
                disabled
                    ? 'pointer-events-none opacity-50 cursor-not-allowed'
                    : 'cursor-pointer',
                compact ? 'gap-2 py-4 px-3' : 'gap-4 py-8 px-6'
            )}>
            {/* Icon container */}
            <div
                className={cn(
                    'flex items-center justify-center rounded-full bg-muted transition-all duration-200 group-hover:bg-primary/10 group-hover:scale-105',
                    compact ? 'size-9' : 'size-14'
                )}>
                <HugeiconsIcon
                    icon={
                        compact
                            ? (compactIcon ?? ImageAdd02Icon)
                            : (icon ?? CloudUploadIcon)
                    }
                    size={compact ? 18 : 26}
                    className='text-muted-foreground group-hover:text-primary transition-colors'
                />
            </div>

            {/* Text */}
            <div className='text-center space-y-1'>
                <p
                    className={cn(
                        'font-medium',
                        compact ? 'text-2xs' : 'text-xs'
                    )}>
                    {label}
                </p>
                {hint && (
                    <p className='text-2xs text-muted-foreground'>{hint}</p>
                )}
            </div>

            {/* CTA - only in full (non-compact) mode */}
            {!compact && (
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='pointer-events-none'
                    tabIndex={-1}>
                    Browse Media Library
                </Button>
            )}
        </div>
    );
}

