'use client';

/**
 * Activity (H-12): the global send-log table. Every filter is SERVER-side,
 * mirroring `GET /email/sends` exactly — templateKey, status, stream,
 * toEmail (exact, case-insensitive), createdAt date range — plus server
 * pagination. Rows open the detail sheet; the toolbar carries the test-send
 * button (H-15).
 */

import { MailAtSign01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import {
    DataTableActions,
    DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import { useTableState } from '@/components/data-table/use-table-state';
import { DatePickerField } from '@/components/date-picker-field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useEmailSends } from '@/hooks/email-centre/use-email-centre';
import { EMAIL_TEMPLATE_LABELS } from '@/lib/emails/template-labels';
import { EMAIL_STREAM, emailSendMeta } from '@/components/common/status-maps';
import {
    EMAIL_SEND_STATUS_VALUES,
    EMAIL_TEMPLATE_KEYS,
    type EmailSendRow,
    type EmailSendStatus,
    type EmailStream,
} from '@/types/email';
import type { EmailSendsQueryParams } from '@/types/email-centre';
import { EMAIL_SEND_COLUMNS } from './email-send-columns';
import { EmailSendDetailSheet } from './email-send-detail-sheet';
import { TestSendDialog } from './test-send-dialog';

// Filter options derive from the shared status maps - one label owner
// (review of #57, Medium 4; the bookings-table convention).
const STREAM_OPTIONS = (
    Object.entries(EMAIL_STREAM) as Array<
        [EmailStream, { label: string }]
    >
).map(([value, meta]) => [value, meta.label] as const);

const STATUS_OPTIONS = EMAIL_SEND_STATUS_VALUES.map(
    (value) => [value, emailSendMeta(value).label] as const,
);

export function EmailActivityView() {
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

    // The search box drives the API's `toEmail` filter, which is an EXACT
    // (case-insensitive) match — not a contains-search. The placeholder says
    // so, because a partial address genuinely finds nothing.
    const params: EmailSendsQueryParams = {
        page,
        limit,
        ...(filters.templateKey ? { templateKey: filters.templateKey } : {}),
        ...(filters.status
            ? { status: filters.status as EmailSendStatus }
            : {}),
        ...(filters.stream ? { stream: filters.stream as EmailStream } : {}),
        ...(debouncedSearch ? { toEmail: debouncedSearch.trim() } : {}),
        // The date pickers hand back YYYY-MM-DD; the API wants ISO instants
        // on createdAt, so widen each day to its UTC bounds.
        ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
        ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
    };

    const { data, isLoading, isError } = useEmailSends(params);
    const rows = data?.data ?? [];

    // Selection is by ROW ID, index derived: a resend invalidates the list
    // and the newest-first refetch prepends the new row, shifting every
    // index - an index-held sheet would silently swap to a DIFFERENT send
    // under the admin's eyes (review of #57, Medium 3). The pager still
    // walks the current page via the derived index.
    const [viewId, setViewId] = useState<string | null>(null);
    const viewIndex =
        viewId != null
            ? (() => {
                  const i = rows.findIndex((r) => r.id === viewId);
                  return i === -1 ? null : i;
              })()
            : null;
    const viewing = viewIndex != null ? (rows[viewIndex] ?? null) : null;

    return (
        <div className='space-y-4'>
            <EmailSendDetailSheet
                send={viewing}
                onOpenChange={(open) => {
                    if (!open) setViewId(null);
                }}
                onPrev={
                    viewIndex != null && viewIndex > 0
                        ? () => setViewId(rows[viewIndex - 1]!.id)
                        : undefined
                }
                onNext={
                    viewIndex != null && viewIndex < rows.length - 1
                        ? () => setViewId(rows[viewIndex + 1]!.id)
                        : undefined
                }
                position={
                    viewIndex != null
                        ? { index: viewIndex + 1, count: rows.length }
                        : undefined
                }
            />
            {isError ? (

                <p className='text-sm text-destructive'>

                    Could not load the email activity log. You need system-admin

                    access, and the filters must be valid — adjust and retry.

                </p>

            ) : null}
            <DataTable
                columns={EMAIL_SEND_COLUMNS}
                getRowId={(r: EmailSendRow) => r.id}
                data={rows}
                isLoading={isLoading}
                onRowClick={(r: EmailSendRow) => setViewId(r.id)
                }
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                empty={{
                    icon: MailAtSign01Icon,
                    title: 'No emails found.',
                    description: 'No send-log rows match the current filters.',
                }}
                toolbar={() => (
                    <>
                        <DataTableSearch
                            value={search}
                            onChange={setSearch}
                            placeholder='Exact recipient email…'
                        />
                        <Select
                            value={filters.templateKey ?? 'all'}
                            onValueChange={(v) =>
                                setFilter(
                                    'templateKey',
                                    v === 'all' ? undefined : v,
                                )
                            }>
                            <SelectTrigger className='w-52 shrink-0'>
                                <SelectValue placeholder='Template' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>
                                    All Templates
                                </SelectItem>
                                {EMAIL_TEMPLATE_KEYS.map((key) => (
                                    <SelectItem key={key} value={key}>
                                        {EMAIL_TEMPLATE_LABELS[key]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.status ?? 'all'}
                            onValueChange={(v) =>
                                setFilter(
                                    'status',
                                    v === 'all' ? undefined : v,
                                )
                            }>
                            <SelectTrigger className='w-36 shrink-0'>
                                <SelectValue placeholder='Status' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>All Status</SelectItem>
                                {EMAIL_SEND_STATUS_VALUES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {emailSendMeta(s).label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.stream ?? 'all'}
                            onValueChange={(v) =>
                                setFilter(
                                    'stream',
                                    v === 'all' ? undefined : v,
                                )
                            }>
                            <SelectTrigger className='w-40 shrink-0'>
                                <SelectValue placeholder='Stream' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>
                                    All Streams
                                </SelectItem>
                                {STREAM_OPTIONS.map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Filters the SENT date (send-log createdAt), never
                            a travel date - same disambiguation the payments
                            toolbar learned the hard way. */}
                        <div className='flex shrink-0 items-center gap-1'>
                            <div className='w-40'>
                                <DatePickerField
                                    value={filters.from ?? ''}
                                    onChange={(v) =>
                                        setFilter('from', v || undefined)
                                    }
                                    placeholder='Sent from'
                                    clearable
                                />
                            </div>
                            <span className='text-xs text-muted-foreground'>
                                to
                            </span>
                            <div className='w-40'>
                                <DatePickerField
                                    value={filters.to ?? ''}
                                    onChange={(v) =>
                                        setFilter('to', v || undefined)
                                    }
                                    placeholder='Sent to'
                                    clearable
                                />
                            </div>
                        </div>
                        <DataTableActions>
                            <TestSendDialog />
                        </DataTableActions>
                    </>
                )}
            />
        </div>
    );
}
