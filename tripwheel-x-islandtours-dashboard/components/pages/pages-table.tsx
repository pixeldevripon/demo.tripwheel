'use client';

import { File02Icon } from '@hugeicons/core-free-icons';

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
import { PAGE_STATUS } from '@/components/common/status-maps';
import { PAGE_STATUS_VALUES, type PageListItem, type PageStatus } from '@/types/pages';
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
  // Client-side status filter: this list is a small unpaged array.
  const [status, setStatus] = useState<'all' | PageStatus>('all');
  const rows = status === 'all' ? data : data.filter((p) => p.status === status);

  return (
    <DataTable
      columns={columns}
      data={rows}
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
          />
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as 'all' | PageStatus)}
          >
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {PAGE_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PAGE_STATUS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DataTableActions>
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
  );
}
