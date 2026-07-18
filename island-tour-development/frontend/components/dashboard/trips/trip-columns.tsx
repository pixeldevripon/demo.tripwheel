'use client';

import type { ReactNode } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { MapPinIcon, BadgeCheckIcon, FolderIcon, NavigationIcon, StarIcon, TicketIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { TourBadgeChip } from '@/components/frontend/tour-badge';
import { TIER_META } from '@/types/tier';
import type { TripListItem, TripStatus } from '@/types/trip';
import { TripRowActions } from './trip-row-actions';

// Shared style for clickable entity links inside table cells.
const entityLink =
  'hover:underline underline-offset-4 decoration-muted-foreground/50';

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
  /** Render the row-selection checkbox column (for bulk actions). Default true. */
  showSelect?: boolean;
  /** Render Rating (★ + review count) and Booked columns. Default false. */
  showPerformance?: boolean;
  /**
   * Trailing cell renderer. Defaults to the trip row-actions dropdown; the
   * Locals' favourites table passes its toggle here instead.
   */
  actions?: (trip: TripListItem) => ReactNode;
}

export function makeTripColumns({
  showOperator = false,
  currentUserEmail,
  showSelect = true,
  showPerformance = false,
  actions,
}: MakeColumnsOptions = {}): ColumnDef<TripListItem>[] {
  const cols: ColumnDef<TripListItem>[] = [];

  if (showSelect) {
    cols.push({
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
    });
  }

  cols.push(
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
      // Commercial placement: tier + rank (the dominant §7.2 sort key) and the
      // §3.6 card badge a shopper would see (derived client-side from the raw
      // signals - the admin list carries no server-derived badge field).
      id: 'placement',
      header: 'Tier & Badge',
      accessorFn: (row) => row.tierRank,
      cell: ({ row }) => {
        const trip = row.original;
        const tier = TIER_META[trip.tierKey];
        const badge = deriveTourBadge(trip);
        return (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={trip.tierRank <= 3 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {tier?.label ?? trip.tierKey}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    #{trip.tierRank}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Ranking key: tier rank {trip.tierRank} · quality{' '}
                  {Number(trip.qualityScore).toFixed(0)}
                </TooltipContent>
              </Tooltip>
            </div>
            {badge && <TourBadgeChip type={badge} size="sm" />}
          </div>
        );
      },
      enableSorting: true,
    },
  );

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
                <Link
                  href={`/dashboard/tour-operators/${info.id}`}
                  className={`text-sm font-medium truncate max-w-32 ${entityLink}`}
                >
                  {displayName}
                </Link>
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
                {/* Admin view: each tour shows its OWN currency (defaultCurrency),
                    never the public shopper NEXT_CURRENCY. */}
                <span className="font-medium text-sm">
                  {formatPriceFrom(price, trip.defaultCurrency, 'en')}
                </span>
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
        const primaryId = row.original.primaryCategoryId;
        const all = row.original.categoryNames ?? [];
        const extra = all.length > 1 ? all.length - 1 : 0;
        const label = primary ?? all[0];
        if (!label) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-1.5">
            <FolderIcon className="size-3.5 text-muted-foreground shrink-0" />
            {primaryId ? (
              <Link
                href={`/dashboard/categories/${primaryId}/edit`}
                className={`text-sm truncate max-w-28 ${entityLink}`}
              >
                {label}
              </Link>
            ) : (
              <span className="text-sm truncate max-w-28">{label}</span>
            )}
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
              <Link
                href={`/dashboard/destinations/${trip.destinationId}/edit`}
                className={`text-sm truncate max-w-28 block ${entityLink}`}
              >
                {dest}
              </Link>
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
  );

  if (showPerformance) {
    cols.push(
      {
        id: 'rating',
        header: 'Rating',
        cell: ({ row }) => {
          const trip = row.original;
          if (!trip.aggregateReviewCount) {
            return <span className="text-xs text-muted-foreground">No reviews</span>;
          }
          return (
            <div className="flex items-center gap-1.5">
              <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />
              <span className="text-sm font-medium tabular-nums">
                {trip.aggregateRating ?? '-'}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ({trip.aggregateReviewCount.toLocaleString()})
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'booked',
        header: 'Booked',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TicketIcon className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {row.original.bookingCount.toLocaleString()}
            </span>
          </div>
        ),
        enableSorting: false,
      },
    );
  }

  cols.push(
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
      cell: ({ row }) =>
        actions ? actions(row.original) : <TripRowActions trip={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
  );

  return cols;
}

// Default operator columns (backward compat)
export const tripColumns = makeTripColumns();
