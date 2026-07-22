'use client';

import { useMemo, useState } from 'react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import { useTableState } from '@/components/data-table/use-table-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRole } from '@/contexts/role-context';
import { useCustomers } from '@/hooks/customers/use-customers';
import type { CustomersQueryParams } from '@/types/customer';
import { customerColumns } from './customer-columns';
import { EmailCustomersDialog } from './email-customers-dialog';

const AWAITING_OPTIONS: [string, string][] = [
  ['all', 'All customers'],
  ['awaiting', 'Awaiting a review'],
];

/**
 * Customers - who has booked, and who still owes a review.
 *
 * Scope is NOT decided here. The backend pins an operator to their own
 * customers after every other filter, so this component asks the same question
 * for everybody and receives a different answer. The only role-dependent thing
 * on this screen is whether an "Operator" column is worth showing (an operator
 * has exactly one) and whether bulk email is offered at all.
 */
export function CustomersListView() {
  const { can } = useRole();
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailIds, setEmailIds] = useState<string[]>([]);

  // MANAGE_USERS, matching the backend. An operator can nudge their own
  // customer for a review but cannot compose arbitrary mail to them.
  const canEmail = can('MANAGE_USERS');
  const showOperator = can('MANAGE_USERS');

  const params: CustomersQueryParams = {
    page,
    limit,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filters.awaiting === 'awaiting' ? { awaitingReviewOnly: true } : {}),
  };
  const { data, isLoading } = useCustomers(params);
  const columns = useMemo(
    () => customerColumns({ showOperator }),
    [showOperator],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        pagination={{
          total: data?.total ?? 0,
          page,
          limit,
          onPageChange: setPage,
          onLimitChange: setLimit,
        }}
        empty={{
          icon: UserGroupIcon,
          title: 'No customers yet.',
          description:
            'A customer appears here once someone completes a booking. Until then this list is empty rather than broken.',
        }}
        toolbar={(table) => (
          <>
            <TableSearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search name or email..."
              className="max-w-sm flex-1"
            />
            <Select
              value={filters.awaiting ?? 'all'}
              onValueChange={(v) => setFilter('awaiting', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {AWAITING_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DataTableActions>
              <DataTableViewOptions table={table} />
            </DataTableActions>
          </>
        )}
        bulkActions={
          canEmail
            ? (rows, clearSelection) => (
                <Button
                  size="sm"
                  onClick={() => {
                    setEmailIds(rows.map((r) => r.original.id));
                    setEmailOpen(true);
                    clearSelection();
                  }}
                >
                  Email selected
                </Button>
              )
            : undefined
        }
      />

      <EmailCustomersDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        customerIds={emailIds}
      />
    </>
  );
}
