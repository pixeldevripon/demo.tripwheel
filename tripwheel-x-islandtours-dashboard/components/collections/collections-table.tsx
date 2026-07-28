'use client';

import { Folder01Icon } from '@hugeicons/core-free-icons';

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
import { COLLECTION_STATUS } from '@/components/common/status-maps';
import { COLLECTION_STATUS_VALUES, type CollectionStatus } from '@/types/enums';
import { makeCollectionColumns } from './collection-columns';
import type { Collection } from '@/types/collection';

interface CollectionsTableProps {
  data: Collection[];
  canEdit: boolean;
  canDelete: boolean;
  onDeactivate: (collection: Collection) => void;
  /** Show the Island column (the cross-island "All Islands" view). */
  showIsland?: boolean;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function CollectionsTable({
  data,
  canEdit,
  canDelete,
  onDeactivate,
  showIsland = false,
  filterSlot,
  actionSlot,
}: CollectionsTableProps) {
  const columns = makeCollectionColumns({
    canEdit,
    canDelete,
    onDeactivate,
    showIsland,
  });
  // Client-side status filter: the per-destination list is a small unpaged array.
  const [status, setStatus] = useState<'all' | CollectionStatus>('all');
  const rows =
    status === 'all' ? data : data.filter((c) => c.status === status);

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={{
        icon: Folder01Icon,
        title: 'No collections found.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search collections...'
          />
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as 'all' | CollectionStatus)}
          >
            <SelectTrigger className='w-36 shrink-0'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              {COLLECTION_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {COLLECTION_STATUS[s].label}
                </SelectItem>
              ))}
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
