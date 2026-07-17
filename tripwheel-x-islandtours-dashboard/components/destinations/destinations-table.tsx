'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Location01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { destinationColumns } from './destination-columns';
import {
  useUpdateDestination,
  useDeleteDestination,
} from '@/hooks/destinations/use-destinations';
import { useRole } from '@/contexts/role-context';
import type { DestinationLocalized } from '@/types/destination';

interface DestinationsTableProps {
  data: DestinationLocalized[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

export function DestinationsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: DestinationsTableProps) {
  const { mutate: updateDestination } = useUpdateDestination();
  const { mutate: deleteDestination } = useDeleteDestination();
  const { can } = useRole();

  // Default view is ACTIVE (matches the old table). 'all' is explicit so the
  // URL can express it; absence means the default.
  const statusValue =
    filters.isActive === 'false'
      ? 'inactive'
      : filters.isActive === 'all'
        ? 'all'
        : 'active';

  const addButton = can('CREATE_DESTINATION') && (
    <Button asChild size='sm'>
      <Link href='/destinations/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add Destination
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={destinationColumns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={{
        icon: Location01Icon,
        title: 'No destinations found.',
        description: 'Add your first destination to get started.',
        action: addButton,
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search destinations...'
            className='max-w-sm flex-1'
          />
          <Select
            value={statusValue}
            onValueChange={(v) =>
              onFilterChange(
                'isActive',
                v === 'all' ? 'all' : v === 'active' ? undefined : 'false',
              )
            }
          >
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
      bulkActions={(rows, clearSelection) => (
        <>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              rows.forEach((r) =>
                updateDestination(
                  { id: r.original.id, payload: { isActive: true } },
                  {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to activate.',
                      ),
                  },
                ),
              );
              toast.success(`${rows.length} destination(s) activated.`);
              clearSelection();
            }}
          >
            Activate
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              rows.forEach((r) =>
                updateDestination(
                  { id: r.original.id, payload: { isActive: false } },
                  {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to deactivate.',
                      ),
                  },
                ),
              );
              toast.success(`${rows.length} destination(s) deactivated.`);
              clearSelection();
            }}
          >
            Deactivate
          </Button>
          {can('DELETE_DESTINATION') && (
            <Button
              size='sm'
              variant='destructive'
              onClick={() => {
                const deletable = rows.filter((r) => !r.original.isSeeded);
                if (deletable.length === 0) {
                  toast.error(
                    'No deletable destinations selected. Seeded destinations are protected.',
                  );
                  return;
                }
                deletable.forEach((r) =>
                  deleteDestination(r.original.id, {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to delete.',
                      ),
                  }),
                );
                toast.success(`${deletable.length} destination(s) deleted.`);
                clearSelection();
              }}
            >
              Delete
            </Button>
          )}
        </>
      )}
    />
  );
}
