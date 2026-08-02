'use client';

import {
    Delete02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    ToggleOffIcon,
    ToggleOnIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

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
    RESOURCE_KIND_LABEL,
    RESOURCE_MODE_EXPLANATION,
    type Resource,
} from '@/types/resource';

export interface MakeResourceColumnsOptions {
    canManage: boolean;
    /**
     * An ADMIN's list is not scoped to one operator. Names are unique per
     * operator, so two operators may each own a "Sea Breeze" - without the
     * owner shown, those are two identical rows.
     */
    showOperator: boolean;
    onEdit: (resource: Resource) => void;
    onToggleActive: (resource: Resource) => void;
    onDelete: (resource: Resource) => void;
}

export function makeResourceColumns({
    canManage,
    showOperator,
    onEdit,
    onToggleActive,
    onDelete,
}: MakeResourceColumnsOptions): ColumnDef<Resource>[] {
    return [
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='text-sm font-medium'>{r.name}</span>
                        {showOperator && (
                            <span className='block truncate text-xs text-muted-foreground'>
                                {r.operatorName ?? 'Unnamed operator'}
                            </span>
                        )}
                        {r.notes && (
                            <span className='block truncate text-xs text-muted-foreground'>
                                {r.notes}
                            </span>
                        )}
                    </div>
                );
            },
            enableSorting: true,
        },
        {
            accessorKey: 'kind',
            header: 'Type',
            cell: ({ row }) => (
                <Badge variant='secondary'>
                    {RESOURCE_KIND_LABEL[row.original.kind]}
                </Badge>
            ),
            enableSorting: true,
        },
        {
            accessorKey: 'capacity',
            header: 'How many',
            cell: ({ row }) => (
                <span className='text-sm tabular-nums'>
                    {row.original.capacity}
                </span>
            ),
            enableSorting: true,
        },
        {
            id: 'tours',
            header: 'Used by',
            cell: ({ row }) => {
                const tours = row.original.tours;
                if (tours.length === 0) {
                    // Worth calling out rather than showing "0": an asset
                    // attached to nothing constrains nothing, which is almost
                    // always a half-finished setup rather than an intention.
                    return (
                        <span className='text-xs text-muted-foreground'>
                            No tours yet
                        </span>
                    );
                }
                return (
                    <div className='flex flex-wrap gap-x-1.5 gap-y-0.5'>
                        {tours.map(t => (
                            <Link
                                key={t.id}
                                href={`/trips/${t.id}/edit?step=schedule`}
                                title={RESOURCE_MODE_EXPLANATION[t.mode]}
                                className='text-xs underline-offset-4 hover:underline'>
                                {t.name}
                            </Link>
                        ))}
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) =>
                row.original.isActive ? (
                    <Badge variant='secondary'>Active</Badge>
                ) : (
                    <Badge variant='outline' className='text-muted-foreground'>
                        Inactive
                    </Badge>
                ),
            enableSorting: true,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                if (!canManage) return null;
                const r = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon-sm'>
                                <HugeiconsIcon icon={MoreHorizontalIcon} />
                                <span className='sr-only'>Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-52'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(r)}>
                                <HugeiconsIcon icon={PencilEdit02Icon} />
                                Edit asset
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleActive(r)}>
                                <HugeiconsIcon
                                    icon={
                                        r.isActive ? ToggleOffIcon : ToggleOnIcon
                                    }
                                />
                                {r.isActive ? 'Deactivate' : 'Reactivate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className='text-destructive focus:text-destructive'
                                onClick={() => onDelete(r)}>
                                <HugeiconsIcon icon={Delete02Icon} />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
            enableSorting: false,
            size: 80,
        },
    ];
}
