'use client';

import { FolderIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import { makeCollectionColumns } from './collection-columns';
import type { Collection } from '@/types/collection';

interface CollectionsTableProps {
  data: Collection[];
  canEdit: boolean;
  canDelete: boolean;
  onDeactivate: (collection: Collection) => void;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function CollectionsTable({
  data,
  canEdit,
  canDelete,
  onDeactivate,
  filterSlot,
  actionSlot,
}: CollectionsTableProps) {
  const columns = makeCollectionColumns({ canEdit, canDelete, onDeactivate });

  return (
    <DataTable
      columns={columns}
      data={data}
      empty={{
        icon: FolderIcon,
        title: 'No collections found.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search collections...'
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
