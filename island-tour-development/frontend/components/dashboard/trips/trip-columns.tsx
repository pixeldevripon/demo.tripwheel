'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { MapPinIcon, ImageIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formateDate } from '@/lib/utils';
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

export const tripColumns: ColumnDef<TripListItem>[] = [
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
    id: 'images',
    header: 'Images',
    cell: ({ row }) => {
      const trip = row.original;
      const count = trip.imageCount ?? 0;
      const hasHero = !!trip.heroImage;
      return (
        <div className="flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-muted-foreground" />
          <span className={`text-xs ${count < 5 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {count}
          </span>
          {!hasHero && count > 0 && (
            <StarIcon className="size-3 text-amber-500" />
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: 'highlights',
    header: 'Highlights',
    cell: ({ row }) => {
      const count = row.original.highlightCount ?? 0;
      return (
        <span className={`text-xs ${count < 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {count}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formateDate(row.original.updatedAt)}
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
];
