import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

import { cn } from '@/lib/utils';

/**
 * IconTile - THE way an icon is presented on cards, stat rows and activity
 * feeds (user spec 2026-07-17): a rounded square holding the icon on a
 * translucent wash of its own color. Variants map to the semantic status
 * palette + brand; never place a raw colored icon on a card without a tile.
 */
export type IconTileVariant =
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'neutral';

const tile: Record<IconTileVariant, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-solid/10 text-success-fg',
    warning: 'bg-warning-solid/10 text-warning-fg',
    danger: 'bg-danger-solid/10 text-danger-fg',
    info: 'bg-info-solid/10 text-info-fg',
    neutral: 'bg-surface-inset text-content-muted',
};

const sizes = {
    sm: 'size-8 rounded-md [&_svg]:size-4',
    default: 'size-10 rounded-lg [&_svg]:size-5',
    lg: 'size-12 rounded-xl [&_svg]:size-6',
} as const;

interface IconTileProps {
    icon: IconSvgElement;
    variant?: IconTileVariant;
    size?: keyof typeof sizes;
    className?: string;
}

export function IconTile({
    icon,
    variant = 'primary',
    size = 'default',
    className,
}: IconTileProps) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex shrink-0 items-center justify-center',
                sizes[size],
                tile[variant],
                className,
            )}>
            <HugeiconsIcon icon={icon} />
        </span>
    );
}
