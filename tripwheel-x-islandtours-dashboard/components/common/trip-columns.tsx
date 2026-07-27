'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkBadge01Icon, Location01Icon, Navigation03Icon, StarIcon, Ticket01Icon } from '@hugeicons/core-free-icons';

import type { ReactNode } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/status-badge';
import { TRIP_STATUS } from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPriceFrom } from '@/lib/currency/current';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { TIER_META } from '@/types/tier';
import type { TripListItem, TripStatus } from '@/types/trip';
import { TripRowActions } from '@/components/trips/trip-row-actions';

// Shared style for clickable entity links inside table cells.
const entityLink =
  'hover:underline underline-offset-4 decoration-muted-foreground/50';

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
                <HugeiconsIcon icon={Location01Icon} className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/trips/${trip.id}/edit`}
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
        const meta = TRIP_STATUS[row.original.status];
        return (
          <StatusBadge variant={meta.variant} hint={meta.hint}>
            {meta.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
    {
      // Commercial placement: tier + rank (the dominant §7.2 sort key) and the
      // §3.6 card badge a shopper would see, derived client-side from the raw
      // signals (the admin list carries no server-derived badge field).
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
            <TourBadgeChip type={badge} />
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
                  href={`/tour-operators/${info.id}`}
                  className={`text-sm font-medium truncate max-w-32 ${entityLink}`}
                >
                  {displayName}
                </Link>
                {isMe && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3.5 text-info-solid shrink-0" />
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
      id: 'location',
      header: 'Destination / Hubs',
      cell: ({ row }) => {
        const trip = row.original;
        const dest = trip.destinationName;
        const hubs = trip.hubNames ?? [];
        if (!dest) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex items-start gap-1.5">
            <HugeiconsIcon icon={Navigation03Icon} className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <Link
                href={`/destinations/${trip.destinationId}/edit`}
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
              <HugeiconsIcon icon={StarIcon} className="size-3.5 shrink-0 fill-rating text-rating" />
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
            <HugeiconsIcon icon={Ticket01Icon} className="size-3.5 shrink-0" />
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
