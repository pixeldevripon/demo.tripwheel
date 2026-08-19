'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, RouteIcon } from '@hugeicons/core-free-icons';

import { useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
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
import { buildHubColumns } from './hub-columns';
import { useUpdateHub, useDeleteHub } from '@/hooks/hubs/use-hubs';
import { useRole } from '@/contexts/role-context';
import type { HubLocalized } from '@/types/hub';
import type { DestinationLocalized } from '@/types/destination';

interface HubsTableProps {
  data: HubLocalized[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  destinations: DestinationLocalized[];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

export function HubsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  destinations,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: HubsTableProps) {
  const { mutate: updateHub } = useUpdateHub();
  const { mutate: deleteHub } = useDeleteHub();
  const { can } = useRole();

  const destinationsMap = useMemo(
    () => new Map(destinations.map((d) => [d.id, d.name])),
    [destinations],
  );
  const columns = useMemo(
    () => buildHubColumns({ destinationsMap }),
    [destinationsMap],
  );

  const statusValue =
    filters.isActive === 'false'
      ? 'inactive'
      : filters.isActive === 'all'
        ? 'all'
        : 'active';

  const addButton = can('MANAGE_HUBS') && (
    <Button asChild size='sm'>
      <Link href='/hubs/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add Hub
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
        icon: RouteIcon,
        title: 'No hubs found.',
        description: 'Add your first hub to get started.',
        action: addButton,
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search hubs...'
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
          <Select
            value={filters.destinationId ?? 'all'}
            onValueChange={(v) =>
              onFilterChange('destinationId', v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger className='w-44 shrink-0'>
              <SelectValue placeholder='Destination' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Destinations</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DataTableActions>
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
                updateHub(
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
              toast.success(`${rows.length} hub(s) activated.`);
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
                updateHub(
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
              toast.success(`${rows.length} hub(s) deactivated.`);
              clearSelection();
            }}
          >
            Deactivate
          </Button>
          {can('MANAGE_HUBS') && (
            <Button
              size='sm'
              variant='destructive'
              onClick={() => {
                const deletable = rows.filter((r) => !r.original.isSeeded);
                if (deletable.length === 0) {
                  toast.error(
                    'No deletable hubs selected. Seeded hubs are protected.',
                  );
                  return;
                }
                deletable.forEach((r) =>
                  deleteHub(r.original.id, {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to delete.',
                      ),
                  }),
                );
                toast.success(`${deletable.length} hub(s) deleted.`);
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
