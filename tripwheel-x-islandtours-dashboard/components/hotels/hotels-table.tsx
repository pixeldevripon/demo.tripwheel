'use client';

import { Hotel01Icon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableActions } from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import type { Hotel } from '@/types/hotel';
import { makeHotelColumns } from './hotel-columns';

interface HotelsTableProps {
    data: Hotel[];
    canManage: boolean;
    onDelete: (hotel: Hotel) => void;
    actionSlot?: React.ReactNode;
}

/**
 * No status filter, unlike the Pages table: this list is a handful of rows and
 * the whole point of looking at it is seeing which one is live next to the ones
 * that are not. Filtering that view down would hide the comparison.
 */
export function HotelsTable({
    data,
    canManage,
    onDelete,
    actionSlot,
}: HotelsTableProps) {
    const columns = makeHotelColumns({ canManage, onDelete });

    return (
        <DataTable
            columns={columns}
            data={data}
            empty={{
                icon: Hotel01Icon,
                title: 'No hotels yet.',
            }}
            toolbar={table => (
                <>
                    <TableSearchInput
                        value={(table.getState().globalFilter as string) ?? ''}
                        onValueChange={table.setGlobalFilter}
                        placeholder='Search hotels...'
                    />
                    <DataTableActions>{actionSlot}</DataTableActions>
                </>
            )}
        />
    );
}
