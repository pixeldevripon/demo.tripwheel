'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Cancel01Icon,
    Delete02Icon,
    File01Icon,
    Image01Icon,
    Link01Icon,
    LinkSquare02Icon,
    Location01Icon,
    Mail01Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getCategoryIconComponent } from '@/lib/constants/category-icons';
import {
    RECOMMENDATION_CATEGORY_ICON,
    RECOMMENDATION_CATEGORY_LABELS,
    RECOMMENDATION_PLACEMENT_LABELS,
    recommendationName,
    type Recommendation,
    type RecommendationPlacement,
    type UpdateRecommendationPayload,
} from '@/types/recommendation';

export interface MakeRecommendationColumnsOptions {
    canManage: boolean;
    onDelete: (recommendation: Recommendation) => void;
    /**
     * The update mutate, threaded in so the row's quick toggles (placements +
     * enabled) can run without the columns owning a hook. Optional: a read-only
     * viewer never sees the toggles.
     */
    onUpdate?: (id: string, payload: UpdateRecommendationPayload) => void;
}

/** Add or remove one placement from a row's set, preserving the rest. */
function togglePlacement(
    placements: RecommendationPlacement[],
    p: RecommendationPlacement,
    on: boolean,
): RecommendationPlacement[] {
    const has = placements.includes(p);
    if (on && !has) return [...placements, p];
    if (!on && has) return placements.filter((x) => x !== p);
    return placements;
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
    onUpdate,
}: MakeRecommendationColumnsOptions): ColumnDef<Recommendation>[] {
    return [
        // Selection column, first - only for managers, since a read-only
        // viewer has no bulk action to run against the selection.
        ...(canManage
            ? [
                  {
                      id: 'select',
                      header: ({ table }) => (
                          <Checkbox
                              checked={
                                  table.getIsAllPageRowsSelected()
                                      ? true
                                      : table.getIsSomePageRowsSelected()
                                        ? 'indeterminate'
                                        : false
                              }
                              onCheckedChange={(value) =>
                                  table.toggleAllPageRowsSelected(!!value)
                              }
                              aria-label='Select all'
                          />
                      ),
                      cell: ({ row }) => (
                          <Checkbox
                              checked={row.getIsSelected()}
                              onCheckedChange={(value) =>
                                  row.toggleSelected(!!value)
                              }
                              aria-label='Select row'
                              onClick={(e) => e.stopPropagation()}
                          />
                      ),
                      enableSorting: false,
                      enableHiding: false,
                      size: 48,
                  } satisfies ColumnDef<Recommendation>,
              ]
            : []),
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
            cell: ({ row }) => {
                const isInternal = row.original.source === 'INTERNAL';
                return (
                    <span className='flex items-center gap-1.5 text-sm'>
                        <HugeiconsIcon
                            icon={isInternal ? Location01Icon : Link01Icon}
                            className='size-4 text-muted-foreground'
                        />
                        {isInternal ? 'Internal' : 'External'}
                    </span>
                );
            },
            enableSorting: false,
            size: 120,
        },
        {
            id: 'category',
            header: 'Category',
            cell: ({ row }) => {
                const cat = row.original.category;
                return (
                    <span className='flex items-center gap-2 text-sm'>
                        <span className='flex size-6 shrink-0 items-center justify-center rounded bg-muted'>
                            <HugeiconsIcon
                                icon={getCategoryIconComponent(
                                    RECOMMENDATION_CATEGORY_ICON[cat],
                                )}
                                className='size-3.5 text-muted-foreground'
                            />
                        </span>
                        {RECOMMENDATION_CATEGORY_LABELS[cat]}
                    </span>
                );
            },
            enableSorting: false,
        },
        {
            id: 'where',
            header: 'Where it shows',
            cell: ({ row }) => {
                const { placements } = row.original;
                if (placements.length === 0)
                    return (
                        <span className='text-sm text-muted-foreground'>-</span>
                    );
                return (
                    <div className='flex flex-wrap gap-1'>
                        {placements.map((p) => (
                            <span
                                key={p}
                                className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
                                <HugeiconsIcon
                                    icon={
                                        p === 'THANK_YOU_PAGE'
                                            ? File01Icon
                                            : Mail01Icon
                                    }
                                    className='size-3'
                                />
                                {RECOMMENDATION_PLACEMENT_LABELS[p]}
                            </span>
                        ))}
                    </div>
                );
            },
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
                const onTyp = rec.placements.includes('THANK_YOU_PAGE');
                const onEmail = rec.placements.includes('CONFIRMATION_EMAIL');
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon-sm'>
                                <HugeiconsIcon icon={MoreHorizontalIcon} />
                                <span className='sr-only'>Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-60'>
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
                            {/* Quick placement + on/off toggles - the same three
                                switches the form owns, reachable without opening it.
                                A tick marks the currently-active state. */}
                            {canManage && onUpdate && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() =>
                                            onUpdate(rec.id, {
                                                placements: togglePlacement(
                                                    rec.placements,
                                                    'THANK_YOU_PAGE',
                                                    !onTyp,
                                                ),
                                            })
                                        }>
                                        <HugeiconsIcon
                                            icon={onTyp ? Tick02Icon : File01Icon}
                                        />
                                        {onTyp
                                            ? 'Hide from thank-you page'
                                            : 'Show on thank-you page'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() =>
                                            onUpdate(rec.id, {
                                                placements: togglePlacement(
                                                    rec.placements,
                                                    'CONFIRMATION_EMAIL',
                                                    !onEmail,
                                                ),
                                            })
                                        }>
                                        <HugeiconsIcon
                                            icon={
                                                onEmail ? Tick02Icon : Mail01Icon
                                            }
                                        />
                                        {onEmail
                                            ? 'Hide from confirmation email'
                                            : 'Show in confirmation email'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() =>
                                            onUpdate(rec.id, {
                                                isEnabled: !rec.isEnabled,
                                            })
                                        }>
                                        <HugeiconsIcon
                                            icon={
                                                rec.isEnabled
                                                    ? Tick02Icon
                                                    : Cancel01Icon
                                            }
                                        />
                                        {rec.isEnabled
                                            ? 'Switch off'
                                            : 'Switch on'}
                                    </DropdownMenuItem>
                                </>
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
