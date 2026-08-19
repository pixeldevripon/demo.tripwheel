'use client';

import { InboxIcon } from '@hugeicons/core-free-icons';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo } from 'react';

import { relativeTime } from '@/components/common/inbox-copy';
import { makeTripColumns } from '@/components/common/trip-columns';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { ContentUpdatesTable } from '@/components/submissions/content-updates-table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useMyPendingChangesQueue,
    useMyTrips,
} from '@/hooks/trips/use-trips';
import type { TripListItem } from '@/types/trip';

const reviewHref = (id: string) => `/trips/${id}/edit?step=review`;

/**
 * The operator's side of the review desk (client review #19 / UX round 3):
 * everything THEY have in flight - new-tour submissions and live-content
 * change sets - with the same lanes the admin queue has, minus the deciding.
 * "Where does my submission stand" stops requiring a walk through every tour.
 */
export function OperatorSubmissionsView() {
    const { page, limit, filters, setPage, setLimit, setFilters } =
        useTableState();
    const lane = filters.lane === 'changes' ? 'changes' : 'tours';
    // 1-row probes keep both tab labels counted whichever lane is active.
    const { data: loopCount } = useMyTrips({ limit: 1, reviewLoop: true });
    const { data: changesCount } = useMyPendingChangesQueue({ limit: 1 });

    const { data, isLoading } = useMyTrips(
        {
            page,
            limit,
            reviewLoop: true,
            sortBy: 'submittedAt',
            sortDir: 'asc',
        },
        lane === 'tours'
    );

    const columns = useMemo<ColumnDef<TripListItem>[]>(() => {
        const base = makeTripColumns({
            showOperator: false,
            showSelect: false,
            actions: trip => (
                <Button asChild size='sm' variant='outline'>
                    <Link href={reviewHref(trip.id)}>View</Link>
                </Button>
            ),
        });
        const submitted: ColumnDef<TripListItem> = {
            accessorKey: 'submittedAt',
            header: 'Submitted',
            cell: ({ row }) => (
                <span className='text-sm text-muted-foreground'>
                    {row.original.submittedAt
                        ? relativeTime(row.original.submittedAt)
                        : '—'}
                </span>
            ),
            enableSorting: false,
        };
        return [...base.slice(0, -1), submitted, base[base.length - 1]];
    }, []);

    const laneTabs = (
        <Tabs
            value={lane}
            onValueChange={v =>
                setFilters({ lane: v === 'changes' ? 'changes' : undefined })
            }>
            <TabsList>
                <TabsTrigger value='tours'>
                    New tours
                    {typeof loopCount?.total === 'number'
                        ? ` (${loopCount.total})`
                        : ''}
                </TabsTrigger>
                <TabsTrigger value='changes'>
                    Content updates
                    {typeof changesCount?.total === 'number'
                        ? ` (${changesCount.total})`
                        : ''}
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );

    if (lane === 'changes') {
        return (
            <div className='space-y-4'>
                {laneTabs}
                <ContentUpdatesTable
                    scope='my'
                    page={page}
                    limit={limit}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                />
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            {laneTabs}
            <DataTable
                columns={columns}
                data={data?.data ?? []}
                isLoading={isLoading}
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                skeletonRows={limit > 10 ? 10 : limit}
                empty={{
                    icon: InboxIcon,
                    title: 'Nothing waiting on Island Tours.',
                    description:
                        'Tours you submit for review show here until they are approved or sent back.',
                }}
            />
        </div>
    );
}
