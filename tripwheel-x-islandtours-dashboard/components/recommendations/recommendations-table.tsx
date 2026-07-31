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
import type { useDeleteRecommendation } from '@/hooks/recommendations/use-recommendations';
import type { Recommendation } from '@/types/recommendation';
import { makeRecommendationColumns } from './recommendation-columns';

interface RecommendationsTableProps {
    data: Recommendation[];
    canManage: boolean;
    onDelete: (recommendation: Recommendation) => void;
    /** The delete mutate, threaded from the list view so the bulk bar can reuse it. */
    deleteRecommendation: ReturnType<typeof useDeleteRecommendation>['mutate'];
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
    actionSlot,
}: RecommendationsTableProps) {
    const columns = makeRecommendationColumns({ canManage, onDelete });

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
                        ? (rows, clearSelection) => (
                              <Button
                                  size='sm'
                                  variant='destructive'
                                  onClick={() =>
                                      setBulkTarget({ rows, clearSelection })
                                  }>
                                  Delete
                              </Button>
                          )
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
