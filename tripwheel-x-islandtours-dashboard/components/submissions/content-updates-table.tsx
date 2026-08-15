'use client';

import { InboxIcon, Location01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

import { relativeTime } from '@/components/common/inbox-copy';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { usePendingChangesQueue } from '@/hooks/trips/use-trips';
import type { PendingChangeArea, PendingChangeQueueRow } from '@/types/trip';

const AREA_LABELS: Record<PendingChangeArea, string> = {
    title: 'Title',
    content: 'Description',
    photos: 'Photos',
};

/** Where a content change set gets decided: the tour's Review step. */
const reviewHref = (tourId: string) => `/trips/${tourId}/edit?step=review`;

const columns: ColumnDef<PendingChangeQueueRow>[] = [
    {
        id: 'tour',
        header: 'Tour',
        cell: ({ row }) => {
            const { tour } = row.original;
            const hero = tour.images[0]?.url;
            return (
                <div className='flex items-center gap-3'>
                    <div className='size-10 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center'>
                        {hero ? (
                            <img
                                src={hero}
                                alt={tour.name}
                                className='size-full object-cover'
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Location01Icon}
                                className='size-4 text-muted-foreground'
                            />
                        )}
                    </div>
                    <div className='min-w-0'>
                        <Link
                            href={reviewHref(tour.id)}
                            className='font-medium hover:underline underline-offset-4 truncate max-w-50 block'>
                            {tour.name}
                        </Link>
                        <span className='font-mono text-xs text-muted-foreground'>
                            {tour.slug}
                        </span>
                    </div>
                </div>
            );
        },
    },
    {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }) => {
            const { operator } = row.original.tour;
            return (
                <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>
                        {operator.companyInfo?.companyName ??
                            operator.user?.name ??
                            'Operator'}
                    </p>
                    {operator.user?.email && (
                        <p className='truncate text-xs text-muted-foreground'>
                            {operator.user.email}
                        </p>
                    )}
                </div>
            );
        },
    },
    {
        id: 'destination',
        header: 'Destination',
        cell: ({ row }) => (
            <span className='text-sm'>
                {row.original.tour.destination.name}
            </span>
        ),
    },
    {
        id: 'changes',
        header: 'Changes',
        cell: ({ row }) => (
            <div className='flex flex-wrap gap-1'>
                {row.original.changedAreas.map(area => (
                    <span
                        key={area}
                        className='rounded-full bg-warning-subtle px-2 py-0.5 text-2xs font-medium text-warning-fg'>
                        {AREA_LABELS[area] ?? area}
                    </span>
                ))}
            </div>
        ),
    },
    {
        id: 'submitted',
        header: 'Submitted',
        cell: ({ row }) => (
            <span className='text-sm text-muted-foreground'>
                {relativeTime(row.original.submittedAt)}
            </span>
        ),
    },
    {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
            <div className='flex justify-end'>
                <Button asChild size='sm' variant='outline'>
                    <Link href={reviewHref(row.original.tour.id)}>Review</Link>
                </Button>
            </div>
        ),
    },
];

/**
 * The Submissions queue's second lane (client review #19 / dashboard #80):
 * open content change sets on LIVE tours, oldest submission first. Deciding
 * happens on the tour's Review step, same as a new-tour submission.
 */
export function ContentUpdatesTable({
    page,
    limit,
    onPageChange,
    onLimitChange,
}: {
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}) {
    const { data, isLoading } = usePendingChangesQueue({ page, limit });

    return (
        <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            pagination={{
                total: data?.total ?? 0,
                page,
                limit,
                onPageChange,
                onLimitChange,
            }}
            skeletonRows={limit > 10 ? 10 : limit}
            empty={{
                icon: InboxIcon,
                title: 'No content updates waiting.',
                description:
                    'Live-tour edits to titles, descriptions or photos land here for approval.',
            }}
        />
    );
}
