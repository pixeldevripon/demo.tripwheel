'use client';

import { Coins01Icon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
    DataTableActions,
    DataTableSearch,
    DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { DatePickerField } from '@/components/date-picker-field';
import { OperatorFilterPopover } from '@/components/common/operator-filter-popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SettlementListItem } from '@/types/booking';
import { makeSettlementColumns } from './settlement-columns';

interface SettlementsTableProps {
    data: SettlementListItem[];
    total: number;
    page: number;
    limit: number;
    isLoading: boolean;
    isAdmin: boolean;
    searchValue: string;
    onSearchChange: (value: string) => void;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    onFilterChange: (key: string, value: string | undefined) => void;
    filters?: Record<string, string | undefined>;
}

// Only the states this ledger actually produces - plain words, matching the
// row badges (Payout due / Paid out / Reversed).
const STATUS_OPTIONS = [
    ['RECORDED', 'Payout due'],
    ['PAID_OUT', 'Paid out'],
    ['REVERSED', 'Reversed (cancelled)'],
] as const;

export function SettlementsTable({
    data,
    total,
    page,
    limit,
    isLoading,
    isAdmin,
    searchValue,
    onSearchChange,
    onPageChange,
    onLimitChange,
    onFilterChange,
    filters = {},
}: SettlementsTableProps) {
    const columns = makeSettlementColumns(isAdmin);

    return (
        <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            pagination={{ total, page, limit, onPageChange, onLimitChange }}
            empty={{
                icon: Coins01Icon,
                title: 'No payouts found.',
                description: isAdmin
                    ? 'No paid-in-full bookings match the current filters. Deposit-model bookings settle themselves and never appear here.'
                    : 'No payouts match the current filters. Only your paid-in-full bookings appear here - deposit bookings settle themselves.',
            }}
            toolbar={(table) => (
                <>
                    <DataTableSearch
                        value={searchValue}
                        onChange={onSearchChange}
                        placeholder='Search booking ref...'
                    />
                    <Select
                        value={filters.status ?? 'all'}
                        onValueChange={(v) =>
                            onFilterChange('status', v === 'all' ? undefined : v)
                        }
                    >
                        <SelectTrigger className='w-48 shrink-0'>
                            <SelectValue placeholder='Status' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>All statuses</SelectItem>
                            {STATUS_OPTIONS.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isAdmin && (
                        <OperatorFilterPopover
                            value={filters.operatorId}
                            onChange={(v) => onFilterChange('operatorId', v)}
                        />
                    )}
                    <div className='flex shrink-0 items-center gap-1'>
                        <div className='w-36'>
                            <DatePickerField
                                value={filters.from ?? ''}
                                onChange={(v) =>
                                    onFilterChange('from', v || undefined)
                                }
                                placeholder='From date'
                                clearable
                            />
                        </div>
                        <span className='text-xs text-muted-foreground'>to</span>
                        <div className='w-36'>
                            <DatePickerField
                                value={filters.to ?? ''}
                                onChange={(v) =>
                                    onFilterChange('to', v || undefined)
                                }
                                placeholder='To date'
                                clearable
                            />
                        </div>
                    </div>
                    <DataTableActions>
                        <DataTableViewOptions table={table} />
                    </DataTableActions>
                </>
            )}
        />
    );
}
