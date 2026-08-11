'use client';

/**
 * The operator approval queue (WP-E, E-07/E-09..E-14): every PENDING operator
 * with a one-click Approve / Reject decision. Modeled on the Spotlight queue,
 * but server-paginated like the operators list (`useTableState` +
 * `useOperators({ verificationStatus: 'PENDING' })`).
 *
 * "Days pending" counts BUSINESS days from signup and highlights rows at or
 * past 2 - the same threshold the backend's INT1R sales reminder fires on, so
 * a highlighted row here matches a nag email in the sales inbox.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Cancel01Icon,
    CheckmarkBadge01Icon,
    Mail01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import {
    DataTableActions,
    DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import { useTableState } from '@/components/data-table/use-table-state';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import { useOperators } from '@/hooks/operators/use-operators';
import {
    businessDaysSince,
    PENDING_BUSINESS_DAY_THRESHOLD,
} from '@/lib/operators/business-days';
import { formatDate } from '@/lib/utils';
import type { OperatorListItem } from '@/types/operator';
import { getOperatorDisplayName } from '@/types/operator';
import { OperatorVerificationSheet } from './operator-verification-sheet';
import {
    ApproveOperatorDialog,
    RejectOperatorDialog,
    type DecisionTarget,
} from './verification-decision-dialogs';

export function VerificationQueueView() {
    const { can } = useRole();
    const canManage = can('MANAGE_OPERATORS');

    const { page, limit, search, debouncedSearch, setPage, setLimit, setSearch } =
        useTableState();

    const { data, isLoading } = useOperators({
        verificationStatus: 'PENDING',
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    const rows = useMemo(() => data?.data ?? [], [data]);

    const [approveTarget, setApproveTarget] = useState<DecisionTarget | null>(
        null,
    );
    const [rejectTarget, setRejectTarget] = useState<DecisionTarget | null>(
        null,
    );
    // Index-based so the sheet's prev/next arrows can walk the current page.
    const [viewIndex, setViewIndex] = useState<number | null>(null);
    const viewing = viewIndex != null ? (rows[viewIndex] ?? null) : null;

    const columns = useMemo(
        () =>
            buildQueueColumns({
                canManage,
                onApprove: setApproveTarget,
                onReject: setRejectTarget,
            }),
        [canManage],
    );

    return (
        <div className='space-y-4'>
            <OperatorVerificationSheet
                operator={viewing}
                onOpenChange={open => {
                    if (!open) setViewIndex(null);
                }}
                onApprove={setApproveTarget}
                onReject={setRejectTarget}
                onPrev={
                    viewIndex != null && viewIndex > 0
                        ? () => setViewIndex(viewIndex - 1)
                        : undefined
                }
                onNext={
                    viewIndex != null && viewIndex < rows.length - 1
                        ? () => setViewIndex(viewIndex + 1)
                        : undefined
                }
                position={
                    viewIndex != null
                        ? { index: viewIndex + 1, count: rows.length }
                        : undefined
                }
            />

            <DataTable
                columns={columns}
                data={rows}
                isLoading={isLoading}
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                onRowClick={(r: OperatorListItem) =>
                    setViewIndex(rows.findIndex(x => x.id === r.id))
                }
                empty={{
                    icon: CheckmarkBadge01Icon,
                    title: 'No operators waiting for review.',
                    description:
                        'New signups land here as Pending once they accept the agreement.',
                }}
                toolbar={() => (
                    <>
                        <DataTableSearch
                            value={search}
                            onChange={setSearch}
                            placeholder='Search company, signatory, email...'
                        />
                        <DataTableActions>{null}</DataTableActions>
                    </>
                )}
            />

            <ApproveOperatorDialog
                target={approveTarget}
                onClose={() => setApproveTarget(null)}
                onDecided={() => setViewIndex(null)}
            />
            <RejectOperatorDialog
                target={rejectTarget}
                onClose={() => setRejectTarget(null)}
                onDecided={() => setViewIndex(null)}
            />
        </div>
    );
}

function buildQueueColumns({
    canManage,
    onApprove,
    onReject,
}: {
    canManage: boolean;
    onApprove: (target: DecisionTarget) => void;
    onReject: (target: DecisionTarget) => void;
}): ColumnDef<OperatorListItem>[] {
    const columns: ColumnDef<OperatorListItem>[] = [
        {
            id: 'company',
            header: 'Company',
            cell: ({ row }) => {
                const op = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='font-medium truncate max-w-56 block'>
                            {op.companyInfo?.companyName ?? '-'}
                        </span>
                        <span className='text-xs text-muted-foreground truncate max-w-56 block'>
                            {op.user.name}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            id: 'email',
            header: 'Email',
            cell: ({ row }) => (
                <div className='flex items-center gap-1.5'>
                    <HugeiconsIcon
                        icon={Mail01Icon}
                        className='size-3 text-muted-foreground shrink-0'
                    />
                    <span className='text-sm truncate max-w-56'>
                        {row.original.user.email}
                    </span>
                </div>
            ),
            enableSorting: false,
        },
        {
            id: 'toursSubmitted',
            header: 'Tours',
            cell: ({ row }) => (
                <span className='tabular-nums'>
                    {row.original.toursSubmitted}
                </span>
            ),
            enableSorting: false,
            size: 72,
        },
        {
            id: 'acceptedAt',
            header: 'Accepted',
            cell: ({ row }) => formatDate(row.original.createdAt),
            enableSorting: false,
        },
        {
            id: 'daysPending',
            header: 'Days pending',
            cell: ({ row }) => {
                const days = businessDaysSince(row.original.createdAt);
                const overdue = days >= PENDING_BUSINESS_DAY_THRESHOLD;
                return (
                    <StatusBadge
                        variant={overdue ? 'warning' : 'neutral'}
                        hint={
                            overdue
                                ? 'At or past the 2-business-day sales reminder threshold (INT1R)'
                                : 'Business days since signup'
                        }>
                        {days} {days === 1 ? 'day' : 'days'}
                    </StatusBadge>
                );
            },
            enableSorting: false,
        },
    ];

    if (canManage) {
        columns.push({
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const op = row.original;
                const target: DecisionTarget = {
                    id: op.id,
                    name: getOperatorDisplayName(op),
                };
                return (
                    <div
                        className='flex justify-end gap-2'
                        onClick={e => e.stopPropagation()}>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => onReject(target)}>
                            <HugeiconsIcon icon={Cancel01Icon} />
                            Reject
                        </Button>
                        <Button size='sm' onClick={() => onApprove(target)}>
                            <HugeiconsIcon icon={Tick02Icon} />
                            Approve
                        </Button>
                    </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
            size: 200,
        });
    }

    return columns;
}
