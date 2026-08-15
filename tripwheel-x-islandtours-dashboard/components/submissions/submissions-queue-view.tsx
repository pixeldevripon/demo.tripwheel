'use client';

import { InboxIcon } from '@hugeicons/core-free-icons';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo } from 'react';

import { relativeTime } from '@/components/common/inbox-copy';
import { OperatorFilterPopover } from '@/components/common/operator-filter-popover';
import { makeTripColumns } from '@/components/common/trip-columns';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-toolbar';
import { useTableState } from '@/components/data-table/use-table-state';
import { ContentUpdatesTable } from '@/components/submissions/content-updates-table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useAdminTrips, usePendingChangesQueue } from '@/hooks/trips/use-trips';
import type { TripListItem } from '@/types/trip';

/** Where a submission gets decided: the tour's Review step (approve/reject). */
const reviewHref = (id: string) => `/trips/${id}/edit?step=review`;

/**
 * The review loop's home - In review AND Changes requested tours live HERE,
 * not on the admin Tours list (client 2026-08-15). The SAME rich rows as the
 * Tours table via the shared column factory, plus a Submitted column and a
 * Review action, sorted FIFO on submittedAt so a burst of new submissions
 * never pushes the earliest one past page 1. The count the nav badge shows
 * is exactly this page's default query (the whole review loop, reviewLoop) -
 * the two must stay in lockstep or the badge promises work this page does
 * not show.
 */
export function SubmissionsQueueView() {
    const {
        page,
        limit,
        search,
        debouncedSearch,
        filters,
        setPage,
        setLimit,
        setSearch,
        setFilter,
        setFilters,
    } = useTableState();
    const { data: destinations } = useActiveDestinations();
    // Two lanes (client review #19): new-tour submissions and live-tour
    // content updates. Lane lives in the URL; switching resets pagination.
    const lane = filters.lane === 'changes' ? 'changes' : 'tours';
    // 1-row probes so BOTH tab labels carry their live count whichever lane
    // is active (the inactive lane's table query is disabled).
    const { data: changesCount } = usePendingChangesQueue({ limit: 1 });
    const { data: loopCount } = useAdminTrips({ limit: 1, reviewLoop: true });
    // Default = the whole review loop (client 2026-08-15: All shows both In
    // review and Changes requested); either state is one tap away.
    const reviewFilter =
        filters.approvalStatus === 'PENDING' ||
        filters.approvalStatus === 'REJECTED'
            ? filters.approvalStatus
            : 'all';
    const { data, isLoading } = useAdminTrips(
        {
            page,
            limit,
            ...(reviewFilter === 'all'
                ? { reviewLoop: true }
                : { approvalStatus: reviewFilter }),
            sortBy: 'submittedAt',
            sortDir: 'asc',
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(filters.destinationId
                ? { destinationId: filters.destinationId }
                : {}),
            ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
        },
        lane === 'tours',
    );

    const columns = useMemo<ColumnDef<TripListItem>[]>(() => {
        const base = makeTripColumns({
            showOperator: true,
            // A queue has no bulk actions - every decision is per tour.
            showSelect: false,
            actions: trip => (
                <Button asChild size='sm' variant='outline'>
                    <Link href={reviewHref(trip.id)}>Review</Link>
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
        // Submitted sits right before the trailing Review action.
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
            toolbar={() => (
                <>
                    <DataTableSearch
                        value={search}
                        onChange={setSearch}
                        placeholder='Search submissions...'
                    />
                    {/* The review axis lives HERE, not on the Tours list
                        (client 2026-08-15). Labels match the row badges. */}
                    <Select
                        value={reviewFilter}
                        onValueChange={v =>
                            setFilter(
                                'approvalStatus',
                                v === 'all' ? undefined : v,
                            )
                        }>
                        <SelectTrigger className='w-44 shrink-0'>
                            <SelectValue placeholder='Status' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>All Status</SelectItem>
                            <SelectItem value='PENDING'>In review</SelectItem>
                            <SelectItem value='REJECTED'>
                                Changes requested
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.destinationId ?? 'all'}
                        onValueChange={v =>
                            setFilter(
                                'destinationId',
                                v === 'all' ? undefined : v,
                            )
                        }>
                        <SelectTrigger className='w-44 shrink-0'>
                            <SelectValue placeholder='Destination' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>
                                All Destinations
                            </SelectItem>
                            {(destinations ?? []).map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <OperatorFilterPopover
                        value={filters.operatorId}
                        onChange={v => setFilter('operatorId', v)}
                    />
                </>
            )}
            empty={{
                icon: InboxIcon,
                title: 'No tours awaiting review.',
                description:
                    'New operator submissions land here the moment they arrive.',
            }}
            />
        </div>
    );
}
