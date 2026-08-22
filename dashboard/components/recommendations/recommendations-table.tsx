'use client';

import { ThumbsUpIcon } from '@hugeicons/core-free-icons';

import { type Row } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableActions } from '@/components/data-table/data-table-toolbar';
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
import type {
    useDeleteRecommendation,
    useUpdateRecommendation,
} from '@/hooks/recommendations/use-recommendations';
import type {
    Recommendation,
    RecommendationPlacement,
    UpdateRecommendationPayload,
} from '@/types/recommendation';
import { makeRecommendationColumns } from './recommendation-columns';

interface RecommendationsTableProps {
    data: Recommendation[];
    canManage: boolean;
    onDelete: (recommendation: Recommendation) => void;
    /** The delete mutate, threaded from the list view so the bulk bar can reuse it. */
    deleteRecommendation: ReturnType<typeof useDeleteRecommendation>['mutate'];
    /** The update mutate, threaded so the row toggles and bulk bar can reuse it. */
    updateRecommendation: ReturnType<typeof useUpdateRecommendation>['mutate'];
    actionSlot?: React.ReactNode;
}

/**
 * No status filter: this list is a handful of rows and the point of looking at
 * it is seeing which one wins each surface next to the ones that do not.
 * Filtering that view down would hide the comparison.
 */
export function RecommendationsTable({
    data,
    canManage,
    onDelete,
    deleteRecommendation,
    updateRecommendation,
    actionSlot,
}: RecommendationsTableProps) {
    const onUpdate = (id: string, payload: UpdateRecommendationPayload) => {
        updateRecommendation(
            { id, payload },
            {
                onError: (err) =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update the recommendation.',
                    ),
            },
        );
    };

    const columns = makeRecommendationColumns({ canManage, onDelete, onUpdate });

    // Bulk delete is confirmed rather than immediate: it fans out across every
    // selected row, so a mis-click is expensive.
    const [bulkTarget, setBulkTarget] = useState<{
        rows: Row<Recommendation>[];
        clearSelection: () => void;
    } | null>(null);

    return (
        <>
            <DataTable
                columns={columns}
                data={data}
                empty={{
                    icon: ThumbsUpIcon,
                    title: 'No recommendations yet.',
                }}
                toolbar={(table) => (
                    <>
                        <TableSearchInput
                            value={
                                (table.getState().globalFilter as string) ?? ''
                            }
                            onValueChange={table.setGlobalFilter}
                            placeholder='Search recommendations...'
                        />
                        <DataTableActions>{actionSlot}</DataTableActions>
                    </>
                )}
                bulkActions={
                    canManage
                        ? (rows, clearSelection) => {
                              // Fan the update mutate over every selected row, then
                              // toast the count and drop the selection. Each build
                              // computes the row's next value from its own current
                              // state, so a shared "add to email" never clobbers the
                              // other surface a row already has.
                              const runBulk = (
                                  build: (
                                      rec: Recommendation,
                                  ) => UpdateRecommendationPayload,
                                  done: string,
                              ) => {
                                  rows.forEach((r) =>
                                      updateRecommendation(
                                          {
                                              id: r.original.id,
                                              payload: build(r.original),
                                          },
                                          {
                                              onError: (err) =>
                                                  toast.error(
                                                      err instanceof Error
                                                          ? err.message
                                                          : 'Failed to update.',
                                                  ),
                                          },
                                      ),
                                  );
                                  toast.success(
                                      `${rows.length} recommendation(s) ${done}.`,
                                  );
                                  clearSelection();
                              };

                              const withPlacement = (
                                  rec: Recommendation,
                                  p: RecommendationPlacement,
                                  on: boolean,
                              ): RecommendationPlacement[] => {
                                  const has = rec.placements.includes(p);
                                  if (on && !has) return [...rec.placements, p];
                                  if (!on && has)
                                      return rec.placements.filter(
                                          (x) => x !== p,
                                      );
                                  return rec.placements;
                              };

                              return (
                                  <div className='flex flex-wrap items-center gap-2'>
                                      <Button
                                          size='sm'
                                          variant='outline'
                                          onClick={() =>
                                              runBulk(
                                                  () => ({ isEnabled: true }),
                                                  'enabled',
                                              )
                                          }>
                                          Enable
                                      </Button>
                                      <Button
                                          size='sm'
                                          variant='outline'
                                          onClick={() =>
                                              runBulk(
                                                  () => ({ isEnabled: false }),
                                                  'disabled',
                                              )
                                          }>
                                          Disable
                                      </Button>
                                      <Button
                                          size='sm'
                                          onClick={() =>
                                              runBulk(
                                                  (rec) => ({
                                                      placements: withPlacement(
                                                          rec,
                                                          'THANK_YOU_PAGE',
                                                          true,
                                                      ),
                                                  }),
                                                  'added to the thank-you page',
                                              )
                                          }>
                                          Add to thank-you page
                                      </Button>
                                      <Button
                                          size='sm'
                                          variant='outline'
                                          onClick={() =>
                                              runBulk(
                                                  (rec) => ({
                                                      placements: withPlacement(
                                                          rec,
                                                          'THANK_YOU_PAGE',
                                                          false,
                                                      ),
                                                  }),
                                                  'removed from the thank-you page',
                                              )
                                          }>
                                          Remove from thank-you page
                                      </Button>
                                      <Button
                                          size='sm'
                                          onClick={() =>
                                              runBulk(
                                                  (rec) => ({
                                                      placements: withPlacement(
                                                          rec,
                                                          'CONFIRMATION_EMAIL',
                                                          true,
                                                      ),
                                                  }),
                                                  'added to the email',
                                              )
                                          }>
                                          Add to email
                                      </Button>
                                      <Button
                                          size='sm'
                                          variant='outline'
                                          onClick={() =>
                                              runBulk(
                                                  (rec) => ({
                                                      placements: withPlacement(
                                                          rec,
                                                          'CONFIRMATION_EMAIL',
                                                          false,
                                                      ),
                                                  }),
                                                  'removed from the email',
                                              )
                                          }>
                                          Remove from email
                                      </Button>
                                      <Button
                                          size='sm'
                                          variant='destructive'
                                          onClick={() =>
                                              setBulkTarget({
                                                  rows,
                                                  clearSelection,
                                              })
                                          }>
                                          Delete
                                      </Button>
                                  </div>
                              );
                          }
                        : undefined
                }
            />

            <AlertDialog
                open={!!bulkTarget}
                onOpenChange={(o) => !o && setBulkTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete the selected recommendations?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            The copy in every language is permanently deleted for
                            each one. Seeded recommendations are skipped - they
                            cannot be deleted, only switched off. This cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!bulkTarget) return;
                                const deletable = bulkTarget.rows.filter(
                                    (r) => !r.original.isSeeded,
                                );
                                if (deletable.length === 0) {
                                    toast.error(
                                        'No deletable recommendations selected. Seeded ones are protected.',
                                    );
                                    setBulkTarget(null);
                                    return;
                                }
                                deletable.forEach((r) =>
                                    deleteRecommendation(r.original.id, {
                                        onError: (err) =>
                                            toast.error(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to delete.',
                                            ),
                                    }),
                                );
                                toast.success(
                                    `${deletable.length} recommendation(s) deleted.`,
                                );
                                bulkTarget.clearSelection();
                                setBulkTarget(null);
                            }}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
