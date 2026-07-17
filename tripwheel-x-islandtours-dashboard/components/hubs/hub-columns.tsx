'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { MapPinIcon, LockIcon, NavigationIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/status-badge';
import { ACTIVE_STATUS } from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate } from '@/lib/utils';
import type { HubLocalized } from '@/types/hub';
import { HUB_STATUS_LABELS, type HubStatus } from '@/types/enums';
import { HubRowActions } from './hub-row-actions';

const statusVariant: Record<HubStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
};

interface HubColumnsOptions {
  destinationsMap: Map<string, string>;
}

export function buildHubColumns(options: HubColumnsOptions): ColumnDef<HubLocalized>[] {
  const { destinationsMap } = options;

  return [
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
        const hub = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
              <NavigationIcon className="size-4 text-muted-foreground" />
            </div>
            <Link
              href={`/hubs/${hub.id}`}
              className="font-medium hover:underline underline-offset-4 truncate max-w-50"
            >
              {hub.name}
            </Link>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'destinationId',
      header: 'Destination',
      cell: ({ row }) => {
        const name = destinationsMap.get(row.original.destinationId);
        return name ? (
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="size-3 text-muted-foreground shrink-0" />
            <span className="text-sm">{name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">{row.original.destinationId.slice(0, 8)}…</span>
        );
      },
      enableSorting: false,
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={statusVariant[status]}>{HUB_STATUS_LABELS[status]}</Badge>;
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isActive',
      header: 'Active',
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
            <LockIcon className="size-3 text-muted-foreground" />
            <Badge variant="secondary">Protected</Badge>
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
      cell: ({ row }) => <HubRowActions hub={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
  ];
}
