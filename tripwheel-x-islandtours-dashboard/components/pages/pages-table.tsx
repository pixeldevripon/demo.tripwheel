'use client';

import { File02Icon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import type { PageListItem } from '@/types/pages';
import { makePageColumns } from './page-columns';

interface PagesTableProps {
  data: PageListItem[];
  canManage: boolean;
  onPublishToggle: (page: PageListItem) => void;
  onDelete: (page: PageListItem) => void;
  actionSlot?: React.ReactNode;
}

export function PagesTable({
  data,
  canManage,
  onPublishToggle,
  onDelete,
  actionSlot,
}: PagesTableProps) {
  const columns = makePageColumns({ canManage, onPublishToggle, onDelete });

  return (
    <DataTable
      columns={columns}
      data={data}
      empty={{
        icon: File02Icon,
        title: 'No pages yet.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder="Search pages..."
            className="min-w-36 flex-1"
          />
          <DataTableActions>
            <DataTableViewOptions table={table} />
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
  );
}
