'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Location01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
  DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { makeTripColumns } from '@/components/common/trip-columns';
import { OperatorFilterPopover } from '@/components/common/operator-filter-popover';
import { useRemoveTrip } from '@/hooks/trips/use-trips';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useRole } from '@/contexts/role-context';
import { useSession } from '@/lib/auth-client';
import type {
  TripApprovalStatus,
  TripListItem,
  TripStatus,
} from '@/types/trip';

interface TripsTableProps {
  data: TripListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  isAdminView?: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  /** Current filter values (URL-derived; empty string = all). */
  filters?: Record<string, string | undefined>;
}

export function TripsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  isAdminView = false,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: TripsTableProps) {
  const { mutate: removeTrip } = useRemoveTrip();
  const { can } = useRole();
  const { data: session } = useSession();
  const { data: destinations } = useActiveDestinations();

  const columns = makeTripColumns({
    showOperator: isAdminView,
    currentUserEmail: session?.user?.email,
  });

  const newTripButton = can('CREATE_TRIP') && (
    <Button asChild size='sm'>
      <Link href='/trips/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        New Trip
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      skeletonRows={limit > 10 ? 10 : limit}
      empty={{
        icon: Location01Icon,
        title: 'No trips found.',
        description: isAdminView
          ? 'No trips match the current filters.'
          : 'Create your first trip to get started.',
        action: newTripButton,
      }}
      toolbar={(table) => (
        <>
          <DataTableSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder='Search trips...'
          />
          {/* ONE control, TWO backend filters. `status` (Draft/Live/Paused/
              Archived) and `approvalStatus` (review workflow) are independent
              axes on the server - submitting for review stamps PENDING and
              leaves `status` where it was - but an operator asking "where is
              the tour I sent in?" is not thinking in axes. So the review
              states are offered in the same list and the handler routes the
              choice to whichever filter owns it, clearing the other so the two
              can never contradict each other.
              Reported 2026-08-02 §03: without this a resubmitted PAUSED or
              ARCHIVED tour could not be found at all. */}
          <Select
            value={filters.approvalStatus ?? filters.status ?? 'all'}
            onValueChange={(v) => {
              const isReview = v === 'PENDING' || v === 'REJECTED';
              onFilterChange(
                'status',
                v === 'all' || isReview ? undefined : (v as TripStatus)
              );
              onFilterChange(
                'approvalStatus',
                isReview ? (v as TripApprovalStatus) : undefined
              );
            }}
          >
            <SelectTrigger className='w-40 shrink-0'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='DRAFT'>Draft</SelectItem>
              <SelectItem value='LIVE'>Live</SelectItem>
              <SelectItem value='PAUSED'>Paused</SelectItem>
              <SelectItem value='ARCHIVED'>Archived</SelectItem>
              {/* Labels match the badges on the rows (TRIP_APPROVAL_STATUS) -
                  a filter that names a state differently from the column it
                  filters is its own bug report. */}
              <SelectItem value='PENDING'>In review</SelectItem>
              <SelectItem value='REJECTED'>Changes requested</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.destinationId ?? 'all'}
            onValueChange={(v) =>
              onFilterChange('destinationId', v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger className='w-44 shrink-0'>
              <SelectValue placeholder='Destination' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Destinations</SelectItem>
              {(destinations ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdminView && (
            <OperatorFilterPopover
              value={filters.operatorId}
              onChange={(v) => onFilterChange('operatorId', v)}
            />
          )}
          <DataTableActions>
            {newTripButton}
          </DataTableActions>
        </>
      )}
      bulkActions={(rows, clearSelection) =>
        can('DELETE_TRIP') && (
          <Button
            size='sm'
            variant='destructive'
            onClick={() => {
              const draftRows = rows.filter(
                (r) => r.original.status === 'DRAFT',
              );
              if (draftRows.length === 0) {
                toast.error(
                  'No deletable trips selected. Only DRAFT trips can be deleted.',
                );
                return;
              }
              draftRows.forEach((r) =>
                removeTrip(r.original.id, {
                  onError: (err) =>
                    toast.error(
                      err instanceof Error ? err.message : 'Failed to delete.',
                    ),
                }),
              );
              toast.success(`${draftRows.length} trip(s) deleted.`);
              clearSelection();
            }}
          >
            Delete
          </Button>
        )
      }
    />
  );
}
