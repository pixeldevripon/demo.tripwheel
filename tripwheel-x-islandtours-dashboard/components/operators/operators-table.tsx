'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Store01Icon } from '@hugeicons/core-free-icons';

import { useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableSearch,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildOperatorColumns } from './operator-columns';
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { useRole } from '@/contexts/role-context';
import type { OperatorListItem } from '@/types/operator';

interface OperatorsTableProps {
  data: OperatorListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onStatusFilterChange: (value: string) => void;
  statusFilter: string;
}

export function OperatorsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  search,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onStatusFilterChange,
  statusFilter,
}: OperatorsTableProps) {
  const { mutateAsync: updateOperatorAsync } = useUpdateOperator();
  const { can } = useRole();
  const columns = useMemo(() => buildOperatorColumns(), []);

  const addButton = can('MANAGE_OPERATORS') && (
    <Button asChild size='sm'>
      <Link href='/tour-operators/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add Tour Operator
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={{
        icon: Store01Icon,
        title: 'No tour operators found.',
        description: 'Invite your first operator to get started.',
        action: addButton,
      }}
      toolbar={(table) => (
        <>
          <DataTableSearch
            value={search}
            onChange={onSearchChange}
            placeholder='Search operators...'
          />
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className='w-36 shrink-0'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='inactive'>Inactive</SelectItem>
            </SelectContent>
          </Select>
          <DataTableActions>
            <DataTableViewOptions table={table} />
            {addButton}
          </DataTableActions>
        </>
      )}
      bulkActions={(rows, clearSelection) =>
        can('MANAGE_OPERATORS') && (
          <>
            {([true, false] as const).map((isActive) => (
              <Button
                key={String(isActive)}
                size='sm'
                variant='outline'
                onClick={async () => {
                  const results = await Promise.allSettled(
                    rows.map((r) =>
                      updateOperatorAsync({
                        id: r.original.id,
                        payload: { isActive },
                      }),
                    ),
                  );
                  const ok = results.filter(
                    (r) => r.status === 'fulfilled',
                  ).length;
                  const failed = results.length - ok;
                  if (ok)
                    toast.success(
                      `${ok} operator(s) ${isActive ? 'activated' : 'deactivated'}.`,
                    );
                  if (failed) toast.error(`${failed} update(s) failed.`);
                  clearSelection();
                }}
              >
                {isActive ? 'Activate' : 'Deactivate'}
              </Button>
            ))}
          </>
        )
      }
    />
  );
}
