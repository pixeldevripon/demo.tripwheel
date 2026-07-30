'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    Hotel01Icon,
    LinkSquare02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
} from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
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
import { hotelName, type Hotel } from '@/types/hotel';

export interface MakeHotelColumnsOptions {
    canManage: boolean;
    onDelete: (hotel: Hotel) => void;
}

/**
 * One STATUS column rather than three flags, because an admin is asking one
 * question: is this the hotel on the site, and if not, why not? The four answers
 * are mutually exclusive and ordered by which explains the most.
 */
function statusOf(hotel: Hotel): {
    label: string;
    variant: 'success' | 'warning' | 'neutral';
    hint: string;
} {
    if (hotel.isPromoted) {
        return {
            label: 'On the site',
            variant: 'success',
            hint: 'This is the hotel travellers see after booking.',
        };
    }
    if (!hotel.isEnabled) {
        return {
            label: 'Switched off',
            variant: 'neutral',
            hint: 'Not in the running. Switch it on to promote it.',
        };
    }
    if (!hotel.isComplete) {
        return {
            label: 'Incomplete',
            variant: 'warning',
            hint: 'Needs a photo, an English name and a booking link before it can show.',
        };
    }
    return {
        label: 'Next in line',
        variant: 'neutral',
        hint: 'Ready, but another hotel has a higher promotion priority.',
    };
}

export function makeHotelColumns({
    canManage,
    onDelete,
}: MakeHotelColumnsOptions): ColumnDef<Hotel>[] {
    return [
        {
            id: 'photo',
            header: '',
            cell: ({ row }) => {
                const { imageUrl } = row.original;
                // `bg-muted` on the container, not the image: an empty frame has
                // to read as "no photo yet" rather than as a broken image, and a
                // missing photo is the single most common reason a hotel is not
                // being promoted.
                return (
                    <div className='flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted'>
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt=''
                                className='size-full object-cover'
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Hotel01Icon}
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
            accessorFn: hotelName,
            header: 'Name',
            cell: ({ row }) => {
                const name = hotelName(row.original);
                if (!canManage)
                    return <span className='text-sm font-medium'>{name}</span>;
                return (
                    <Link
                        href={`/hotels/${row.original.id}/edit`}
                        className='text-sm font-medium hover:underline underline-offset-4'>
                        {name}
                    </Link>
                );
            },
            enableSorting: true,
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
            id: 'sleeps',
            header: 'Sleeps',
            cell: ({ row }) => (
                <span className='text-xs text-muted-foreground'>
                    {row.original.sleeps ?? '-'}
                </span>
            ),
            enableSorting: false,
            size: 80,
        },
        {
            id: 'price',
            header: 'Per night',
            cell: ({ row }) => {
                const { pricePerNight, currency } = row.original;
                if (pricePerNight === null)
                    return <span className='text-xs text-muted-foreground'>-</span>;
                return (
                    <span className='text-xs text-muted-foreground'>
                        {/* The row's OWN currency - never a hardcoded symbol. */}
                        {pricePerNight} {currency}
                    </span>
                );
            },
            enableSorting: false,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const hotel = row.original;
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
                                    <Link href={`/hotels/${hotel.id}/edit`}>
                                        <HugeiconsIcon icon={PencilEdit02Icon} />
                                        Edit
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {/* The listing itself lives on someone else's site
                                (Airbnb, Booking.com, ...) - we hold a link to it
                                and nothing more, so "view" can only mean opening
                                that. There is no on-site page to preview: the
                                card renders on a thank-you page reachable only
                                with a real booking reference. */}
                            {hotel.bookingUrl && (
                                <DropdownMenuItem asChild>
                                    <a
                                        href={hotel.bookingUrl}
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
                                        an error, and mirrors how seeded
                                        destinations behave. */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <DropdownMenuItem
                                                    className='text-destructive focus:text-destructive'
                                                    disabled={hotel.isSeeded}
                                                    onClick={() =>
                                                        !hotel.isSeeded &&
                                                        onDelete(hotel)
                                                    }>
                                                    <HugeiconsIcon
                                                        icon={Delete02Icon}
                                                    />
                                                    Delete
                                                </DropdownMenuItem>
                                            </span>
                                        </TooltipTrigger>
                                        {hotel.isSeeded && (
                                            <TooltipContent>
                                                Seeded hotels cannot be deleted.
                                                Switch it off instead.
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
