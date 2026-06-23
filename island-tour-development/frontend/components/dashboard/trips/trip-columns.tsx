'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { MapPinIcon, BadgeCheckIcon, FolderIcon, NavigationIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import type { TripListItem, TripStatus } from '@/types/trip';
import { TripRowActions } from './trip-row-actions';

const statusVariant: Record<TripStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  LIVE: 'default',
  PAUSED: 'outline',
  ARCHIVED: 'destructive',
};

const statusLabel: Record<TripStatus, string> = {
  DRAFT: 'Draft',
  LIVE: 'Live',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
};

interface MakeColumnsOptions {
  showOperator?: boolean;
  currentUserEmail?: string;
}

export function makeTripColumns({ showOperator = false, currentUserEmail }: MakeColumnsOptions = {}): ColumnDef<TripListItem>[] {
  const cols: ColumnDef<TripListItem>[] = [
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
      header: 'Trip',
      cell: ({ row }) => {
        const trip = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
              {trip.heroImage?.url ? (
                <img
                  src={trip.heroImage.url}
                  alt={trip.heroImage.altText ?? trip.name}
                  className="size-full object-cover"
                />
              ) : (
                <MapPinIcon className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/dashboard/trips/${trip.id}/edit`}
                className="font-medium hover:underline underline-offset-4 truncate max-w-50 block"
              >
                {trip.name}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">{trip.slug}</span>
            </div>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full shrink-0 ${
                status === 'LIVE'
                  ? 'bg-emerald-500'
                  : status === 'PAUSED'
                  ? 'bg-amber-500'
                  : status === 'ARCHIVED'
                  ? 'bg-red-500'
                  : 'bg-muted-foreground'
              }`}
            />
            <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
          </div>
        );
      },
      enableSorting: true,
    },
  ];

  if (showOperator) {
    cols.push({
      id: 'operator',
      header: 'Operator',
      cell: ({ row }) => {
        const info = row.original.operatorInfo;
        if (!info) return <span className="text-xs text-muted-foreground">-</span>;
        const displayName = info.companyName ?? info.userName;
        const isMe = currentUserEmail && info.userEmail === currentUserEmail;
        return (
          <div className="flex items-start gap-1.5 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate max-w-32">{displayName}</span>
                {isMe && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <BadgeCheckIcon className="size-3.5 text-blue-500 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Your trip</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate block max-w-36">{info.userEmail}</span>
            </div>
          </div>
        );
      },
      enableSorting: false,
    });
  }

  cols.push(
    {
      accessorKey: 'basePrice',
      header: 'Pricing',
      cell: ({ row }) => {
        const trip = row.original;
        const price = trip.priceFrom ?? trip.basePrice;
        return (
          <div className="flex items-center gap-1.5">
            {price ? (
              <>
                <span className="font-medium text-sm">${price}</span>
                <Badge variant="secondary" className="text-xs">
                  {trip.pricingModel === 'PER_PERSON' ? '/person' : '/unit'}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">No price set</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const primary = row.original.primaryCategoryName;
        const all = row.original.categoryNames ?? [];
        const extra = all.length > 1 ? all.length - 1 : 0;
        const label = primary ?? all[0];
        if (!label) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-1.5">
            <FolderIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate max-w-28">{label}</span>
            {extra > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">+{extra}</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'location',
      header: 'Destination / Hubs',
      cell: ({ row }) => {
        const trip = row.original;
        const dest = trip.destinationName;
        const hubs = trip.hubNames ?? [];
        if (!dest) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex items-start gap-1.5">
            <NavigationIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm truncate max-w-28">{dest}</div>
              {hubs.length > 0 && (
                <div className="text-xs text-muted-foreground truncate max-w-28">
                  {hubs.join(', ')}
                </div>
              )}
            </div>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.updatedAt)}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <TripRowActions trip={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
  );

  return cols;
}

// Default operator columns (backward compat)
export const tripColumns = makeTripColumns();
