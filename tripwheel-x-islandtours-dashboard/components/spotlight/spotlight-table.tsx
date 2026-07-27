'use client';

import { SparklesIcon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import {
  makeSpotlightColumns,
  type SpotlightRequestWithInfo,
} from './spotlight-columns';


interface SpotlightTableProps {
  data: SpotlightRequestWithInfo[];
  canApprove: boolean;
  onApprove: (request: SpotlightRequestWithInfo) => void;
  onReject: (request: SpotlightRequestWithInfo) => void;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function SpotlightTable({
  data,
  canApprove,
  onApprove,
  onReject,
  filterSlot,
  actionSlot,
}: SpotlightTableProps) {
  const columns = makeSpotlightColumns({ canApprove, onApprove, onReject });

  return (
    <DataTable
      columns={columns}
      data={data}
      empty={{
        icon: SparklesIcon,
        title: 'No spotlight requests match these filters.',
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search tours, operators...'
            className='min-w-36 flex-1'
          />
          {filterSlot}
          <DataTableActions>
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
  );
}
