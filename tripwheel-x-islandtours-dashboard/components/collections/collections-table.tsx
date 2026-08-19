'use client';

import { Folder01Icon } from '@hugeicons/core-free-icons';

import { type Row } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COLLECTION_STATUS } from '@/components/common/status-maps';
import type { useDeleteCollection } from '@/hooks/collections/use-collections';
import { COLLECTION_STATUS_VALUES, type CollectionStatus } from '@/types/enums';
import { makeCollectionColumns } from './collection-columns';
import type { Collection } from '@/types/collection';

interface CollectionsTableProps {
  data: Collection[];
  canEdit: boolean;
  canDelete: boolean;
  onDeactivate: (collection: Collection) => void;
  /** The deactivate mutate, threaded from the list view so the bulk bar can reuse it. */
  deleteCollection: ReturnType<typeof useDeleteCollection>['mutate'];
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
  deleteCollection,
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

  // Bulk deactivate is confirmed rather than immediate: it fans out across
  // every selected row, so a mis-click is expensive.
  const [bulkTarget, setBulkTarget] = useState<{
    rows: Row<Collection>[];
    clearSelection: () => void;
  } | null>(null);

  return (
    <>
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
        bulkActions={
          canDelete
            ? (selected, clearSelection) => (
                <Button
                  size='sm'
                  variant='destructive'
                  onClick={() =>
                    setBulkTarget({ rows: selected, clearSelection })
                  }
                >
                  Deactivate
                </Button>
              )
            : undefined
        }
      />

      <AlertDialog
        open={!!bulkTarget}
        onOpenChange={(o) => !o && setBulkTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate the selected collections?</AlertDialogTitle>
            <AlertDialogDescription>
              Each one is hidden from the public site. Already-inactive
              collections are skipped. The records and their slugs are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!bulkTarget) return;
                const deactivatable = bulkTarget.rows.filter(
                  (r) => r.original.isActive,
                );
                if (deactivatable.length === 0) {
                  toast.error('No active collections selected.');
                  setBulkTarget(null);
                  return;
                }
                deactivatable.forEach((r) =>
                  deleteCollection(r.original.id, {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to deactivate.',
                      ),
                  }),
                );
                toast.success(
                  `${deactivatable.length} collection(s) deactivated.`,
                );
                bulkTarget.clearSelection();
                setBulkTarget(null);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
