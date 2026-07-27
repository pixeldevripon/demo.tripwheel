'use client';

import { SparklesIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import {
  makeSpotlightColumns,
  type SpotlightRequestWithInfo,
} from './spotlight-columns';
import { SpotlightDetailSheet } from './spotlight-detail-sheet';


interface SpotlightTableProps {
  data: SpotlightRequestWithInfo[];
  isLoading?: boolean;
  canApprove: boolean;
  onApprove: (request: SpotlightRequestWithInfo) => void;
  onReject: (request: SpotlightRequestWithInfo) => void;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function SpotlightTable({
  data,
  isLoading = false,
  canApprove,
  onApprove,
  onReject,
  filterSlot,
  actionSlot,
}: SpotlightTableProps) {
  const columns = makeSpotlightColumns({ canApprove, onApprove, onReject });
  // Index-based so the sheet's prev/next arrows can walk the current page.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const viewing = viewIndex != null ? (data[viewIndex] ?? null) : null;

  return (
    <>
    <SpotlightDetailSheet
      request={viewing}
      canApprove={canApprove}
      onApprove={onApprove}
      onReject={onReject}
      onOpenChange={(open) => {
        if (!open) setViewIndex(null);
      }}
      onPrev={
        viewIndex != null && viewIndex > 0
          ? () => setViewIndex(viewIndex - 1)
          : undefined
      }
      onNext={
        viewIndex != null && viewIndex < data.length - 1
          ? () => setViewIndex(viewIndex + 1)
          : undefined
      }
      position={
        viewIndex != null
          ? { index: viewIndex + 1, count: data.length }
          : undefined
      }
    />
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      onRowClick={(r: SpotlightRequestWithInfo) =>
        setViewIndex(data.findIndex((x) => x.id === r.id))
      }
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
          />
          {filterSlot}
          <DataTableActions>
            {actionSlot}
          </DataTableActions>
        </>
      )}
    />
    </>
  );
}
