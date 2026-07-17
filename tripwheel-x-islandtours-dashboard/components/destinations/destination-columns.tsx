'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Location01Icon, SquareLock02Icon } from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { ACTIVE_STATUS } from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate } from '@/lib/utils';
import type { DestinationLocalized } from '@/types/destination';
import { DestinationRowActions } from './destination-row-actions';

export const destinationColumns: ColumnDef<DestinationLocalized>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 48,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const destination = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
            {destination.heroImage ? (
              <img
                src={destination.heroImage}
                alt={destination.name}
                className="size-full object-cover"
              />
            ) : (
              <HugeiconsIcon icon={Location01Icon} className="size-4 text-muted-foreground" />
            )}
          </div>
          <Link
            href={`/destinations/${destination.id}`}
            className="font-medium hover:underline underline-offset-4 truncate max-w-50"
          >
            {destination.name}
          </Link>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
        {row.original.slug}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const meta = ACTIVE_STATUS[row.original.isActive ? 'active' : 'inactive'];
      return <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>;
    },
    enableSorting: true,
  },
  {
    accessorKey: 'isSeeded',
    header: 'Seeded',
    cell: ({ row }) => {
      if (!row.original.isSeeded) return null;
      return (
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={SquareLock02Icon} className="size-3 text-muted-foreground" />
          <StatusBadge variant="neutral">Protected</StatusBadge>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formatDate(row.original.createdAt)}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <DestinationRowActions destination={row.original} />,
    enableSorting: false,
    enableHiding: false,
    size: 48,
  },
];
