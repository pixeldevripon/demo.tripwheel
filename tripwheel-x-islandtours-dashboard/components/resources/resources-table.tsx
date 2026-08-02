'use client';

import { BoatIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableActions } from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Resource } from '@/types/resource';
import { makeResourceColumns } from './resource-columns';

interface ResourcesTableProps {
    data: Resource[];
    isLoading?: boolean;
    canManage: boolean;
    showOperator: boolean;
    onEdit: (resource: Resource) => void;
    onToggleActive: (resource: Resource) => void;
    onDelete: (resource: Resource) => void;
    actionSlot?: React.ReactNode;
}

export function ResourcesTable({
    data,
    isLoading,
    canManage,
    showOperator,
    onEdit,
    onToggleActive,
    onDelete,
    actionSlot,
}: ResourcesTableProps) {
    const columns = makeResourceColumns({
        canManage,
        showOperator,
        onEdit,
        onToggleActive,
        onDelete,
    });

    // Client-side: an operator has a handful of assets, not thousands.
    const [active, setActive] = useState<'all' | 'active' | 'inactive'>('all');
    const rows =
        active === 'all'
            ? data
            : data.filter(r => r.isActive === (active === 'active'));

    return (
        <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            getRowId={r => r.id}
            empty={{
                icon: BoatIcon,
                title: 'No equipment or staff yet.',
                description:
                    'Add the boats, vehicles and guides your tours share, so two tours are never sold onto the same one at the same time.',
            }}
            toolbar={table => (
                <>
                    <TableSearchInput
                        value={(table.getState().globalFilter as string) ?? ''}
                        onValueChange={table.setGlobalFilter}
                        placeholder='Search equipment...'
                    />
                    <Select
                        value={active}
                        onValueChange={v =>
                            setActive(v as 'all' | 'active' | 'inactive')
                        }>
                        <SelectTrigger className='w-36 shrink-0'>
                            <SelectValue placeholder='Status' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>All Status</SelectItem>
                            <SelectItem value='active'>Active</SelectItem>
                            <SelectItem value='inactive'>Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <DataTableActions>{actionSlot}</DataTableActions>
                </>
            )}
        />
    );
}
