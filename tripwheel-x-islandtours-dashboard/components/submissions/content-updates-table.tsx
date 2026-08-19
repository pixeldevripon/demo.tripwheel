'use client';

import { InboxIcon, Location01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

import { relativeTime } from '@/components/common/inbox-copy';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import {
    useMyPendingChangesQueue,
    usePendingChangesQueue,
} from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import type { PendingChangeArea, PendingChangeQueueRow } from '@/types/trip';
import { PENDING_AREA_LABELS } from '@/lib/trips/pending-change-labels';

/** Where a content change set gets decided: the tour's Review step. */
const reviewHref = (tourId: string) => `/trips/${tourId}/edit?step=review`;

function buildColumns(scope: 'admin' | 'my'): ColumnDef<PendingChangeQueueRow>[] {
    const cols: ColumnDef<PendingChangeQueueRow>[] = [
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
    ];

    if (scope === 'admin') {
        cols.push({
            id: 'operator',
            header: 'Operator',
            cell: ({ row }) => {
                const { operator } = row.original.tour;
                return (
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-medium'>
                            {operator?.companyInfo?.companyName ??
                                operator?.user?.name ??
                                'Operator'}
                        </p>
                        {operator?.user?.email && (
                            <p className='truncate text-xs text-muted-foreground'>
                                {operator.user.email}
                            </p>
                        )}
                    </div>
                );
            },
        });
    } else {
        // The operator lane mixes open and sent-back sets - the state IS the
        // column that tells them whether anything needs doing.
        cols.push({
            id: 'state',
            header: 'Status',
            cell: ({ row }) => {
                const rejected = row.original.status === 'REJECTED';
                return (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-2xs font-medium',
                            rejected
                                ? 'bg-danger-subtle text-danger-fg'
                                : 'bg-warning-subtle text-warning-fg'
                        )}>
                        {rejected ? 'Changes requested' : 'In review'}
                    </span>
                );
            },
        });
    }

    cols.push(
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
                            {PENDING_AREA_LABELS[area] ?? area}
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
                        <Link href={reviewHref(row.original.tour.id)}>
                            {scope === 'admin' ? 'Review' : 'View'}
                        </Link>
                    </Button>
                </div>
            ),
        }
    );

    return cols;
}

const ADMIN_COLUMNS = buildColumns('admin');
const MY_COLUMNS = buildColumns('my');

/**
 * The Submissions page's content lane. Admin scope: open change sets across
 * all tours, FIFO, with the operator named. Operator scope ('my'): THEIR
 * tours' latest sets - open AND sent back - with the state as a column
 * (client review #19 / UX round 3: operators track what they sent and where
 * it stands, like admins).
 */
export function ContentUpdatesTable({
    scope = 'admin',
    page,
    limit,
    onPageChange,
    onLimitChange,
}: {
    scope?: 'admin' | 'my';
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}) {
    const admin = usePendingChangesQueue(
        { page, limit },
        scope === 'admin'
    );
    const mine = useMyPendingChangesQueue({ page, limit }, scope === 'my');
    const { data, isLoading } = scope === 'admin' ? admin : mine;

    return (
        <DataTable
            columns={scope === 'admin' ? ADMIN_COLUMNS : MY_COLUMNS}
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
                title:
                    scope === 'admin'
                        ? 'No content updates waiting.'
                        : 'No content changes in flight.',
                description:
                    scope === 'admin'
                        ? 'Live-tour edits to titles, descriptions or photos land here for approval.'
                        : 'Edits you make to a live tour’s title, description or photos will show here while Island Tours reviews them.',
            }}
        />
    );
}
