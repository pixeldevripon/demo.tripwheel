'use client';

import { Coins01Icon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
    DataTableActions,
    DataTableViewOptions,
} from '@/components/data-table/data-table-toolbar';
import { DatePickerField } from '@/components/date-picker-field';
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
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    onFilterChange: (key: string, value: string | undefined) => void;
    filters?: Record<string, string | undefined>;
}

const STATUS_OPTIONS = [
    ['RECORDED', 'Recorded'],
    ['PAID_OUT', 'Paid out'],
    ['INVOICED', 'Invoiced'],
    ['SETTLED', 'Settled'],
] as const;

const MODEL_OPTIONS = [
    ['PAID_IN_FULL', 'Paid in full'],
    ['OPERATOR_LINK', 'Operator link'],
    ['ON_ARRIVAL', 'On arrival'],
    ['OPERATOR_FULL', 'Operator full'],
] as const;

export function SettlementsTable({
    data,
    total,
    page,
    limit,
    isLoading,
    onPageChange,
    onLimitChange,
    onFilterChange,
    filters = {},
}: SettlementsTableProps) {
    const columns = makeSettlementColumns();

    return (
        <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            pagination={{ total, page, limit, onPageChange, onLimitChange }}
            empty={{
                icon: Coins01Icon,
                title: 'No settlements found.',
                description: 'No settlement rows match the current filters.',
            }}
            toolbar={(table) => (
                <>
                    <Select
                        value={filters.status ?? 'all'}
                        onValueChange={(v) =>
                            onFilterChange('status', v === 'all' ? undefined : v)
                        }
                    >
                        <SelectTrigger className='w-44 shrink-0'>
                            <SelectValue placeholder='Status' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>All Status</SelectItem>
                            {STATUS_OPTIONS.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.paymentModel ?? 'all'}
                        onValueChange={(v) =>
                            onFilterChange(
                                'paymentModel',
                                v === 'all' ? undefined : v,
                            )
                        }
                    >
                        <SelectTrigger className='w-40 shrink-0'>
                            <SelectValue placeholder='Model' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>All Models</SelectItem>
                            {MODEL_OPTIONS.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
