'use client';

import {
  type OperatorFacet,
  VERIFICATION_FILTER_VALUES,
} from './operator-filters';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Store01Icon } from '@hugeicons/core-free-icons';

import { useMemo } from 'react';
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
import { buildOperatorColumns } from './operator-columns';
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { useRole } from '@/contexts/role-context';
import type { OperatorListItem } from '@/types/operator';

/**
 * Verification status chip row: server-side `?verificationStatus=` filter.
 * Derived from the list view's exported filter values - single source.
 */
const VERIFICATION_CHIPS = [
  { value: 'all', label: 'All' },
  ...VERIFICATION_FILTER_VALUES.map((v) => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
  })),
] as const;

/** Pipeline facets (client-side on the fetched page - see list view). */
const FACET_CHIPS = [
  { value: 'zeroTours', label: '0 tours' },
  { value: 'firstTourLive', label: 'First tour live' },
] as const;

interface OperatorsTableProps {
  data: OperatorListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onStatusFilterChange: (value: string) => void;
  statusFilter: string;
  verificationFilter: string;
  onVerificationFilterChange: (value: string) => void;
  facet: OperatorFacet | undefined;
  onFacetChange: (value: OperatorFacet | undefined) => void;
}

export function OperatorsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  search,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onStatusFilterChange,
  statusFilter,
  verificationFilter,
  onVerificationFilterChange,
  facet,
  onFacetChange,
}: OperatorsTableProps) {
  const { mutateAsync: updateOperatorAsync } = useUpdateOperator();
  const { can } = useRole();
  const columns = useMemo(() => buildOperatorColumns(), []);

  const addButton = can('MANAGE_OPERATORS') && (
    <Button asChild size='sm'>
      <Link href='/tour-operators/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add Tour Operator
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={
        facet && total > 0
          ? {
              icon: Store01Icon,
              title: 'No operators on this page match the facet.',
              description:
                'The facet filters the current page only - page through, or clear it to see everything.',
            }
          : {
              icon: Store01Icon,
              title: 'No tour operators found.',
              description: 'Invite your first operator to get started.',
              action: addButton,
            }
      }
      toolbar={(table) => (
        <>
          <DataTableSearch
            value={search}
            onChange={onSearchChange}
            placeholder='Search operators...'
          />
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className='w-36 shrink-0'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='inactive'>Inactive</SelectItem>
            </SelectContent>
          </Select>
          {/* Onboarding pipeline chips (WP-E E-16): verification status is a
              server-side filter; the two facets narrow the fetched page to
              the zero-tour non-responders / first-tour-live cohorts. */}
          <div
            className='flex items-center gap-1'
            role='group'
            aria-label='Verification status filter'>
            {VERIFICATION_CHIPS.map((chip) => (
              <Button
                key={chip.value}
                size='sm'
                variant={
                  verificationFilter === chip.value ? 'secondary' : 'ghost'
                }
                aria-pressed={verificationFilter === chip.value}
                onClick={() => onVerificationFilterChange(chip.value)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
          <div
            className='flex items-center gap-1'
            role='group'
            aria-label='Pipeline facets'>
            {FACET_CHIPS.map((chip) => (
              <Button
                key={chip.value}
                size='sm'
                variant={facet === chip.value ? 'secondary' : 'outline'}
                aria-pressed={facet === chip.value}
                onClick={() =>
                  onFacetChange(facet === chip.value ? undefined : chip.value)
                }
              >
                {chip.label}
              </Button>
            ))}
          </div>
          <DataTableActions>
            {addButton}
          </DataTableActions>
        </>
      )}
      bulkActions={(rows, clearSelection) =>
        can('MANAGE_OPERATORS') && (
          <>
            {([true, false] as const).map((isActive) => (
              <Button
                key={String(isActive)}
                size='sm'
                variant='outline'
                onClick={async () => {
                  const results = await Promise.allSettled(
                    rows.map((r) =>
                      updateOperatorAsync({
                        id: r.original.id,
                        payload: { isActive },
                      }),
                    ),
                  );
                  const ok = results.filter(
                    (r) => r.status === 'fulfilled',
                  ).length;
                  const failed = results.length - ok;
                  if (ok)
                    toast.success(
                      `${ok} operator(s) ${isActive ? 'activated' : 'deactivated'}.`,
                    );
                  if (failed) toast.error(`${failed} update(s) failed.`);
                  clearSelection();
                }}
              >
                {isActive ? 'Activate' : 'Deactivate'}
              </Button>
            ))}
          </>
        )
      }
    />
  );
}
