'use client';

import { ThumbsUpIcon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableActions } from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import type { Recommendation } from '@/types/recommendation';
import { makeRecommendationColumns } from './recommendation-columns';

interface RecommendationsTableProps {
    data: Recommendation[];
    canManage: boolean;
    onDelete: (recommendation: Recommendation) => void;
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
    actionSlot,
}: RecommendationsTableProps) {
    const columns = makeRecommendationColumns({ canManage, onDelete });

    return (
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
                        value={(table.getState().globalFilter as string) ?? ''}
                        onValueChange={table.setGlobalFilter}
                        placeholder='Search recommendations...'
                    />
                    <DataTableActions>{actionSlot}</DataTableActions>
                </>
            )}
        />
    );
}
