'use client';

/**
 * Read-only quick view of everything the curation list knows about one tour.
 * Opened by a row click; the trimmed list columns (pricing, booked count -
 * plus status, pinned to LIVE for the whole list) live here in full. The
 * Mark/Remove favourite action is available in the footer so a curator can
 * decide while reading the details.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';
import { TRIP_STATUS } from '@/components/common/status-maps';
import {
  MoneyRow,
  Row,
  Section,
  SheetPager,
  type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { formatPriceFrom } from '@/lib/currency/current';
import { formatDate } from '@/lib/utils';
import { TIER_META } from '@/types/tier';
import type { TripListItem } from '@/types/trip';

interface LocalsFavouriteDetailSheetProps extends SheetPagerProps {
  trip: TripListItem | null;
  /** Mark/remove handler from the table (shares its confirm + busy state). */
  onToggle: (trip: TripListItem) => void;
  isToggling: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocalsFavouriteDetailSheet({
  trip,
  onToggle,
  isToggling,
  onOpenChange,
  ...pager
}: LocalsFavouriteDetailSheetProps) {
  return (
    <Sheet open={trip !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl!">
        {trip && (
          <LocalsFavouriteDetailBody
            trip={trip}
            onToggle={onToggle}
            isToggling={isToggling}
            {...pager}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LocalsFavouriteDetailBody({
  trip: t,
  onToggle,
  isToggling,
  onPrev,
  onNext,
  position,
}: {
  trip: TripListItem;
  onToggle: (trip: TripListItem) => void;
  isToggling: boolean;
} & SheetPagerProps) {
  const statusMeta = TRIP_STATUS[t.status];
  const tier = TIER_META[t.tierKey];
  const price = t.priceFrom ?? t.basePrice;
  const operator = t.operatorInfo;

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="truncate">{t.name}</SheetTitle>
              {t.isLocalsFavourite && (
                <StatusBadge
                  variant="warning"
                  hint="Badged and surfaced in the Locals' favourites grids"
                >
                  Locals&apos; favourite
                </StatusBadge>
              )}
            </div>
            <SheetDescription className="truncate font-mono text-xs">
              {t.slug}
            </SheetDescription>
          </div>
          <SheetPager onPrev={onPrev} onNext={onNext} position={position} />
        </div>
      </SheetHeader>

      <div className="flex-1 divide-y overflow-y-auto px-4">
        <Section label="Tour">
          <Row
            label="Tour"
            value={
              <Link
                href={`/trips/${t.id}/edit`}
                className="hover:underline underline-offset-4"
              >
                {t.name}
              </Link>
            }
          />
          <Row
            label="Status"
            value={
              <StatusBadge variant={statusMeta.variant} hint={statusMeta.hint}>
                {statusMeta.label}
              </StatusBadge>
            }
          />
          <Row
            label="Operator"
            value={
              operator ? (
                <Link
                  href={`/tour-operators/${operator.id}`}
                  className="hover:underline underline-offset-4"
                >
                  {operator.companyName ?? operator.userName}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <Row
            label="Destination"
            value={
              t.destinationName ? (
                <Link
                  href={`/destinations/${t.destinationId}/edit`}
                  className="hover:underline underline-offset-4"
                >
                  {t.destinationName}
                </Link>
              ) : (
                '-'
              )
            }
          />
          {(t.hubNames ?? []).length > 0 && (
            <Row label="Hubs" value={(t.hubNames ?? []).join(', ')} />
          )}
          <div className="mt-2 divide-y rounded-lg border bg-muted/30">
            <MoneyRow
              label={`Price from (${t.pricingModel === 'PER_PERSON' ? 'per person' : 'per unit'})`}
              value={
                price
                  ? formatPriceFrom(price, t.defaultCurrency, 'en')
                  : 'No price set'
              }
              strong
            />
          </div>
        </Section>

        <Section label="Performance">
          <Row
            label="Rating"
            value={
              t.aggregateReviewCount
                ? `${t.aggregateRating ?? '-'}/5 (${t.aggregateReviewCount.toLocaleString()} ${t.aggregateReviewCount === 1 ? 'review' : 'reviews'})`
                : 'No reviews yet'
            }
          />
          <Row
            label="Bookings"
            value={
              <span className="tabular-nums">
                {t.bookingCount.toLocaleString()}
              </span>
            }
          />
          <Row
            label="Tier"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Badge
                  variant={t.tierRank <= 3 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {tier?.label ?? t.tierKey}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  #{t.tierRank}
                </span>
              </span>
            }
          />
          <Row
            label="Card badge"
            value={<TourBadgeChip type={deriveTourBadge(t)} />}
          />
        </Section>

        <Section label="Timeline">
          {t.firstPublishedAt && (
            <Row
              label="First published"
              value={formatDate(t.firstPublishedAt, 'long')}
            />
          )}
          {t.lastBookedAt && (
            <Row label="Last booked" value={formatDate(t.lastBookedAt, 'long')} />
          )}
          <Row label="Updated" value={formatDate(t.updatedAt, 'long')} />
        </Section>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button
          variant={t.isLocalsFavourite ? 'outline' : 'default'}
          disabled={isToggling}
          onClick={() => onToggle(t)}
        >
          <HugeiconsIcon
            icon={StarIcon}
            className={t.isLocalsFavourite ? 'fill-rating text-rating' : ''}
          />
          {isToggling
            ? 'Saving...'
            : t.isLocalsFavourite
              ? 'Remove favourite'
              : "Mark as Locals' favourite"}
        </Button>
      </SheetFooter>
    </>
  );
}
