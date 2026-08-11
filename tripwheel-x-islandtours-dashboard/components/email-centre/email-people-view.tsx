'use client';

/**
 * People (H-14): who is opted out of what, and who consented to marketing.
 * Two tabs over two paginated, email-searchable lists — `GET /email/opt-outs`
 * and `GET /email/consents`. The tab lives in the URL (?tab=consents) like
 * every other filter, so reload and shared links restore the exact view.
 */

import Link from 'next/link';
import { MailBlock01Icon, MailValidation01Icon } from '@hugeicons/core-free-icons';
import { type ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-toolbar';
import { useTableState } from '@/components/data-table/use-table-state';
import { StatusBadge } from '@/components/common/status-badge';
import {
    emailAudienceMeta,
    emailStreamMeta,
} from '@/components/common/status-maps';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useEmailConsents,
    useEmailOptOuts,
} from '@/hooks/email-centre/use-email-centre';
import { formatDate } from '@/lib/utils';
import type {
    EmailConsentRow,
    EmailOptOutRow,
    EmailPeopleQueryParams,
} from '@/types/email-centre';

const optOutColumns: ColumnDef<EmailOptOutRow>[] = [
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
            <span className='block max-w-64 truncate text-sm font-medium'>
                {row.original.email}
            </span>
        ),
        enableSorting: false,
    },
    {
        accessorKey: 'audience',
        header: 'Audience',
        cell: ({ row }) => {
            const meta = emailAudienceMeta(row.original.audience);
            return (
                <StatusBadge variant={meta.variant} hint={meta.hint}>
                    {meta.label}
                </StatusBadge>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: 'stream',
        header: 'Stream',
        cell: ({ row }) => {
            const meta = emailStreamMeta(row.original.stream);
            return (
                <StatusBadge variant={meta.variant} hint={meta.hint}>
                    {meta.label}
                </StatusBadge>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
            <span className='text-sm text-muted-foreground'>
                {row.original.source}
            </span>
        ),
        enableSorting: false,
    },
    {
        accessorKey: 'createdAt',
        header: 'Opted out',
        cell: ({ row }) => (
            <span className='whitespace-nowrap text-sm'>
                {formatDate(row.original.createdAt, 'long')}
            </span>
        ),
        enableSorting: false,
    },
];

const consentColumns: ColumnDef<EmailConsentRow>[] = [
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
            <span className='block max-w-64 truncate text-sm font-medium'>
                {row.original.email}
            </span>
        ),
        enableSorting: false,
    },
    {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
            <span className='text-sm text-muted-foreground'>
                {row.original.source}
            </span>
        ),
        enableSorting: false,
    },
    {
        accessorKey: 'bookingId',
        header: 'Booking',
        cell: ({ row }) => {
            const c = row.original;
            if (!c.bookingId) {
                return <span className='text-content-muted'>-</span>;
            }
            // The bookings list searches ref / name / email - never the
            // internal booking id - so the deep link filters by the
            // consent's email (an admin seat searches contactEmail) and the
            // raw id stays visible for support lookups.
            return (
                <Link
                    href={`/bookings?q=${encodeURIComponent(c.email)}`}
                    onClick={(e) => e.stopPropagation()}
                    title={`Booking ${c.bookingId} - opens the bookings list filtered to this traveller's email`}
                    className='block max-w-40 truncate font-mono text-xs hover:underline underline-offset-4'>
                    {c.bookingId}
                </Link>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: 'createdAt',
        header: 'Consented',
        cell: ({ row }) => (
            <span className='whitespace-nowrap text-sm'>
                {formatDate(row.original.createdAt, 'long')}
            </span>
        ),
        enableSorting: false,
    },
];

export function EmailPeopleView() {
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
    } = useTableState();

    const tab = filters.tab === 'consents' ? 'consents' : 'opt-outs';

    const params: EmailPeopleQueryParams = {
        page,
        limit,
        ...(debouncedSearch ? { email: debouncedSearch.trim() } : {}),
    };

    // Only the visible tab queries; the other stays disabled until opened.
    const optOuts = useEmailOptOuts(params, tab === 'opt-outs');
    const consents = useEmailConsents(params, tab === 'consents');
    const active = tab === 'opt-outs' ? optOuts : consents;

    const searchBox = (
        <DataTableSearch
            value={search}
            onChange={setSearch}
            placeholder='Search by email (prefix or exact)…'
        />
    );

    return (
        <div className='space-y-4'>
            <Tabs
                value={tab}
                // Switching tabs via setFilter resets to page 1, exactly the
                // behaviour a tab switch needs.
                onValueChange={(v) =>
                    setFilter('tab', v === 'opt-outs' ? undefined : v)
                }>
                <TabsList>
                    <TabsTrigger value='opt-outs'>Opt-outs</TabsTrigger>
                    <TabsTrigger value='consents'>Consents</TabsTrigger>
                </TabsList>
            </Tabs>

            {tab === 'opt-outs' ? (
                <DataTable
                    columns={optOutColumns}
                    data={optOuts.data?.data ?? []}
                    isLoading={optOuts.isLoading}
                    pagination={{
                        total: optOuts.data?.total ?? 0,
                        page,
                        limit,
                        onPageChange: setPage,
                        onLimitChange: setLimit,
                    }}
                    empty={{
                        icon: MailBlock01Icon,
                        title: 'No opt-outs found.',
                        description:
                            'Nobody matching this search has unsubscribed.',
                    }}
                    toolbar={() => searchBox}
                />
            ) : (
                <DataTable
                    columns={consentColumns}
                    data={consents.data?.data ?? []}
                    isLoading={consents.isLoading}
                    pagination={{
                        total: consents.data?.total ?? 0,
                        page,
                        limit,
                        onPageChange: setPage,
                        onLimitChange: setLimit,
                    }}
                    empty={{
                        icon: MailValidation01Icon,
                        title: 'No consents found.',
                        description:
                            'Nobody matching this search has opted in to marketing.',
                    }}
                    toolbar={() => searchBox}
                />
            )}
            {active.isError && (
                <p className='m-0 text-sm text-danger-fg'>
                    Could not load the list. Reload to try again.
                </p>
            )}
        </div>
    );
}
