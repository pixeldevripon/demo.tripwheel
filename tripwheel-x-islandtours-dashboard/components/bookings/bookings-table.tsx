'use client';

import { Ticket01Icon } from '@hugeicons/core-free-icons';

import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableSearch,
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
import { useRole } from '@/contexts/role-context';
import { useState } from 'react';
import { BOOKING_DISPLAY_STATUS } from '@/components/common/status-maps';
import type { BookingDisplayStatus, BookingListItem } from '@/types/booking';
import { makeBookingColumns } from './booking-columns';
import { BookingDetailsSheet } from './booking-details-sheet';
import { BookingRowActions } from './booking-row-actions';

interface BookingsTableProps {
  data: BookingListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  /** DASH3 queue mode: request/window/refund columns, no status filter. */
  cancellationView?: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

// Raw statuses + the derived refinements the chips show (backend translates
// the derived values to their defining predicates; labels from the shared map).
const STATUS_OPTIONS = [
  'ON_HOLD',
  'PENDING',
  'CONFIRMED',
  'CANCELLATION_REQUESTED',
  'NON_PAYMENT_REPORTED',
  'REDEEMED',
  'EXPIRED',
  'CANCELLED',
  'FORFEITED',
  'REJECTED',
] as const;

const MODEL_OPTIONS = [
  ['OPERATOR_LINK', 'Operator link'],
  ['ON_ARRIVAL', 'On arrival'],
  ['PAID_IN_FULL', 'Paid in full'],
  ['OPERATOR_FULL', 'Operator full'],
] as const;

export function BookingsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  cancellationView = false,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: BookingsTableProps) {
  const { role } = useRole();

  // Details sheet state lives here (not per-row) so prev/next arrows can walk
  // the rows of the current page.
  const [detailsIndex, setDetailsIndex] = useState<number | null>(null);
  const detailsBooking = detailsIndex != null ? data[detailsIndex] : undefined;

  const columns = makeBookingColumns({
    cancellationView,
    // Commission is the platform's cut (rule #22 snapshot) - admin eyes only.
    showCommission: role === 'ADMIN',
    // Clicking the reference cell opens the same details sheet as the row menu.
    onOpenDetails: (booking) =>
      setDetailsIndex(data.findIndex((b) => b.id === booking.id)),
    actions: (booking) => (
      <BookingRowActions
        booking={booking}
        onViewDetails={() =>
          setDetailsIndex(data.findIndex((b) => b.id === booking.id))
        }
      />
    ),
  });

  return (
    <>
      {detailsBooking && detailsIndex != null && (
        <BookingDetailsSheet
          booking={detailsBooking}
          open
          onOpenChange={(open) => {
            if (!open) setDetailsIndex(null);
          }}
          onPrev={
            detailsIndex > 0 ? () => setDetailsIndex(detailsIndex - 1) : undefined
          }
          onNext={
            detailsIndex < data.length - 1
              ? () => setDetailsIndex(detailsIndex + 1)
              : undefined
          }
          position={{ index: detailsIndex + 1, count: data.length }}
        />
      )}
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={{
        icon: Ticket01Icon,
        // An empty PENDING queue is the good case ("all caught up"), not the
        // same thing as having no requests at all - say which.
        title: !cancellationView
          ? 'No bookings found.'
          : (filters.queue ?? 'pending') === 'pending'
            ? 'Nothing pending.'
            : 'No cancellation requests.',
        description:
          cancellationView && (filters.queue ?? 'pending') === 'pending'
            ? 'Every cancellation request has been processed.'
            : 'Nothing matches the current filters.',
      }}
      toolbar={(table) => (
        <>
          <DataTableSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder='Search ref, guest, email or tour...'
          />
          {cancellationView ? (
            /* Queue state, not raw booking status - an admin working this page
               thinks in outstanding vs done. Defaults to Pending so the list
               is a real to-do list; Processed keeps the history reachable. */
            <Select
              value={filters.queue ?? 'pending'}
              onValueChange={(v) => onFilterChange('queue', v)}
            >
              <SelectTrigger className='w-36 shrink-0'>
                <SelectValue placeholder='Queue' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='processed'>Processed</SelectItem>
                <SelectItem value='all'>All requests</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={filters.status ?? 'all'}
              onValueChange={(v) =>
                onFilterChange('status', v === 'all' ? undefined : v)
              }
            >
              <SelectTrigger className='w-32 shrink-0'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BOOKING_DISPLAY_STATUS[s as BookingDisplayStatus]?.label ??
                      s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={filters.paymentModel ?? 'all'}
            onValueChange={(v) =>
              onFilterChange('paymentModel', v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger className='w-44 shrink-0'>
              <SelectValue placeholder='Payment model' />
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
          {/* Travel-date range (matches the backend `from`/`to` on localDate). */}
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
          <DataTableActions>
            <DataTableViewOptions table={table} />
          </DataTableActions>
        </>
      )}
    />
    </>
  );
}
