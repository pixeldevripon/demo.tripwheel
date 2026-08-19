'use client';

import { Database01Icon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { makeAttributeColumns } from './attribute-columns';
import type { AttributeDefinition } from '@/types/attribute';

interface AttributesTableProps {
  data: AttributeDefinition[];
  canManage: boolean;
  onDeactivate: (attribute: AttributeDefinition) => void;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function AttributesTable({
  data,
  canManage,
  onDeactivate,
  filterSlot,
  actionSlot,
}: AttributesTableProps) {
  const columns = makeAttributeColumns({ canManage, onDeactivate });
  // Client-side active filter: the list is a small unpaged array.
  const [active, setActive] = useState<'all' | 'active' | 'inactive'>('all');
  const rows =
    active === 'all'
      ? data
      : data.filter((a) => a.isActive === (active === 'active'));

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={{
        icon: Database01Icon,
        title: 'No attributes found.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search attributes...'
          />
          <Select
            value={active}
            onValueChange={(v) =>
              setActive(v as 'all' | 'active' | 'inactive')
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
          {filterSlot}
          <DataTableActions>
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
  );
}
