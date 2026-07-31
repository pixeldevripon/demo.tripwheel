'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    Image01Icon,
    LinkSquare02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
} from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    RECOMMENDATION_PLACEMENT_LABELS,
    recommendationName,
    type Recommendation,
} from '@/types/recommendation';

export interface MakeRecommendationColumnsOptions {
    canManage: boolean;
    onDelete: (recommendation: Recommendation) => void;
}

/**
 * One STATUS column rather than several flags, because an admin is asking one
 * question: is this recommendation on the site, and if not, why not? The answers
 * are mutually exclusive and ordered by which explains the most.
 */
function statusOf(rec: Recommendation): {
    label: string;
    variant: 'success' | 'warning' | 'neutral';
    hint: string;
} {
    if (rec.featuredPlacements.length > 0) {
        const where = rec.featuredPlacements
            .map((p) => RECOMMENDATION_PLACEMENT_LABELS[p].toLowerCase())
            .join(' and ');
        return {
            label: 'On the site',
            variant: 'success',
            hint: `Shown on the ${where} after a booking.`,
        };
    }
    if (!rec.isEnabled) {
        return {
            label: 'Switched off',
            variant: 'neutral',
            hint: 'Not in the running. Switch it on to promote it.',
        };
    }
    if (rec.placements.length === 0) {
        return {
            label: 'No surface',
            variant: 'warning',
            hint: 'Not assigned to any surface. Pick at least one to show it.',
        };
    }
    if (!rec.isComplete) {
        return {
            label: 'Incomplete',
            variant: 'warning',
            hint:
                rec.source === 'INTERNAL'
                    ? 'Its linked entity no longer resolves.'
                    : 'Needs a photo, an English name and a link before it can show.',
        };
    }
    return {
        label: 'Next in line',
        variant: 'neutral',
        hint: 'Ready, but another recommendation has a higher promotion priority.',
    };
}

export function makeRecommendationColumns({
    canManage,
    onDelete,
}: MakeRecommendationColumnsOptions): ColumnDef<Recommendation>[] {
    return [
        {
            id: 'photo',
            header: '',
            cell: ({ row }) => {
                const rec = row.original;
                // `bg-muted` on the container, not the image: an empty frame has
                // to read as "no photo yet" rather than as a broken image.
                // INTERNAL rows draw their imagery live from the entity, so they
                // legitimately have none here.
                return (
                    <div className='flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted'>
                        {rec.imageUrl ? (
                            <img
                                src={rec.imageUrl}
                                alt=''
                                className='size-full object-cover'
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Image01Icon}
                                className='size-4 text-muted-foreground'
                            />
                        )}
                    </div>
                );
            },
            enableSorting: false,
            size: 72,
        },
        {
            id: 'name',
            accessorFn: recommendationName,
            header: 'Name',
            cell: ({ row }) => {
                const name = recommendationName(row.original);
                if (!canManage)
                    return <span className='text-sm font-medium'>{name}</span>;
                return (
                    <Link
                        href={`/recommendations/${row.original.id}/edit`}
                        className='text-sm font-medium hover:underline underline-offset-4'>
                        {name}
                    </Link>
                );
            },
            enableSorting: true,
        },
        {
            id: 'source',
            header: 'Source',
            cell: ({ row }) => (
                <Badge variant='secondary'>
                    {row.original.source === 'INTERNAL'
                        ? 'Internal'
                        : 'External'}
                </Badge>
            ),
            enableSorting: false,
            size: 100,
        },
        {
            id: 'category',
            header: 'Category',
            cell: ({ row }) => (
                <span className='text-xs text-muted-foreground'>
                    {row.original.category?.name ?? 'Uncategorised'}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const meta = statusOf(row.original);
                return (
                    <StatusBadge variant={meta.variant} hint={meta.hint}>
                        {meta.label}
                    </StatusBadge>
                );
            },
            enableSorting: false,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const rec = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon-sm'>
                                <HugeiconsIcon icon={MoreHorizontalIcon} />
                                <span className='sr-only'>Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-56'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {canManage && (
                                <DropdownMenuItem asChild>
                                    <Link
                                        href={`/recommendations/${rec.id}/edit`}>
                                        <HugeiconsIcon
                                            icon={PencilEdit02Icon}
                                        />
                                        Edit
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {/* EXTERNAL picks live on someone else's site - we
                                hold a link and nothing more, so "view" opens it.
                                INTERNAL picks render on a thank-you page reachable
                                only with a real booking reference, so there is
                                nothing to preview. */}
                            {rec.source === 'EXTERNAL' && rec.linkUrl && (
                                <DropdownMenuItem asChild>
                                    <a
                                        href={rec.linkUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'>
                                        <HugeiconsIcon icon={LinkSquare02Icon} />
                                        View listing
                                    </a>
                                </DropdownMenuItem>
                            )}
                            {canManage && (
                                <>
                                    <DropdownMenuSeparator />
                                    {/* Seeded rows are undeletable - the API
                                        answers 403. Disabling it here with a
                                        reason beats letting an admin click into
                                        an error. */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <DropdownMenuItem
                                                    className='text-destructive focus:text-destructive'
                                                    disabled={rec.isSeeded}
                                                    onClick={() =>
                                                        !rec.isSeeded &&
                                                        onDelete(rec)
                                                    }>
                                                    <HugeiconsIcon
                                                        icon={Delete02Icon}
                                                    />
                                                    Delete
                                                </DropdownMenuItem>
                                            </span>
                                        </TooltipTrigger>
                                        {rec.isSeeded && (
                                            <TooltipContent>
                                                Seeded recommendations cannot be
                                                deleted. Switch it off instead.
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
            enableSorting: false,
            size: 80,
        },
    ];
}
