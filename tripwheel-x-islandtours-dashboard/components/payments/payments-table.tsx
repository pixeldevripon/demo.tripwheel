'use client';

import { CreditCardIcon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import { DatePickerField } from '@/components/date-picker-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentListItem } from '@/types/booking';
import { makePaymentColumns } from './payment-columns';

interface PaymentsTableProps {
  data: PaymentListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

const STATUS_OPTIONS = [
  ['REQUIRES_PAYMENT', 'Requires payment'],
  ['PROCESSING', 'Processing'],
  ['SUCCEEDED', 'Succeeded'],
  ['FAILED', 'Failed'],
  ['REFUNDED', 'Refunded'],
  ['PARTIALLY_REFUNDED', 'Partially refunded'],
  ['CANCELLED', 'Cancelled'],
] as const;

const KIND_OPTIONS = [
  ['DEPOSIT', 'Deposit'],
  ['BALANCE', 'Balance'],
  ['FULL', 'Full'],
  ['REFUND', 'Refund'],
] as const;

export function PaymentsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: PaymentsTableProps) {
  const columns = makePaymentColumns();

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={{
        icon: CreditCardIcon,
        title: 'No payments found.',
        description: 'No payments match the current filters.',
      }}
      toolbar={(table) => (
        <>
          <DataTableSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder='Search booking ref or guest...'
          />
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
            value={filters.kind ?? 'all'}
            onValueChange={(v) =>
              onFilterChange('kind', v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger className='w-32 shrink-0'>
              <SelectValue placeholder='Kind' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Kinds</SelectItem>
              {KIND_OPTIONS.map(([value, label]) => (
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
                onChange={(v) => onFilterChange('from', v || undefined)}
                placeholder='From date'
                clearable
              />
            </div>
            <span className='text-xs text-muted-foreground'>to</span>
            <div className='w-36'>
              <DatePickerField
                value={filters.to ?? ''}
                onChange={(v) => onFilterChange('to', v || undefined)}
                placeholder='To date'
                clearable
              />
            </div>
          </div>
        </>
      )}
    />
  );
}
