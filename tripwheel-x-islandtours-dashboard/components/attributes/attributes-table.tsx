'use client';

import { DatabaseIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
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

  return (
    <DataTable
      columns={columns}
      data={data}
      empty={{
        icon: DatabaseIcon,
        title: 'No attributes found.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search attributes...'
            className='min-w-36 flex-1'
          />
          {filterSlot}
          <DataTableActions>
            <DataTableViewOptions table={table} />
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
  );
}
