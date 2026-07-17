'use client';

/**
 * Read-only quick view of everything the list row knows about a booking
 * (Phase 20) - a side sheet with prev/next arrows so an admin can walk a
 * page of bookings row-to-row without re-opening from the table each time.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { bookingMoney as money, paymentModelLabel, refundDue } from '@/lib/bookings/format';
import type { BookingListItem } from '@/types/booking';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs font-semibold text-content-muted shrink-0">
        {label}
      </span>
      <span className="text-sm text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

export function BookingDetailsSheet({
  booking: b,
  open,
  onOpenChange,
  onPrev,
  onNext,
  position,
}: {
  booking: BookingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Navigate to the previous row on the current page; omit to disable. */
  onPrev?: () => void;
  /** Navigate to the next row on the current page; omit to disable. */
  onNext?: () => void;
  /** 1-based position within the current page, for the "n of N" label. */
  position?: { index: number; count: number };
}) {
  const due = refundDue(b);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full sm:max-w-lg! flex-col gap-0">
        <SheetHeader className="border-b">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="font-mono">{b.displayRef}</SheetTitle>
              <SheetDescription>
                Booked {formatDate(b.createdAt, 'long')}
              </SheetDescription>
            </div>
            {(onPrev || onNext) && (
              <div className="flex shrink-0 items-center gap-1">
                {position && (
                  <span className="mr-1 text-xs tabular-nums text-content-subtle">
                    {position.index} of {position.count}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous booking"
                  onClick={onPrev}
                  disabled={!onPrev}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next booking"
                  onClick={onNext}
                  disabled={!onNext}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 divide-y overflow-y-auto px-4 py-2">
          <Row label="Status" value={<Badge>{b.status}</Badge>} />
          <Row label="Tour" value={b.tourName} />
          <Row
            label="Travel date"
            value={`${formatDate(b.localDate)}${b.startTime ? ` · ${b.startTime}` : ''}`}
          />
          <Row label="Guest" value={b.contactFullName ?? '-'} />
          <Row label="Email" value={b.contactEmail ?? '-'} />
          <Row label="Party size" value={b.partySize} />
          <Row label="Payment model" value={paymentModelLabel[b.paymentModel]} />
          <Row label="Total" value={money(b.totalRetail, b.currency)} />
          <Row label="Deposit" value={money(b.depositAmount, b.currency)} />
          <Row label="Balance" value={money(b.balanceAmount, b.currency)} />
          {b.commissionAmount != null && (
            <Row
              label="Commission"
              value={`${money(b.commissionAmount, b.currency)}${
                b.commissionRate != null
                  ? ` (${(Number(b.commissionRate) * 100).toFixed(1)}%)`
                  : ''
              }`}
            />
          )}
          {b.utcConfirmedAt && (
            <Row label="Confirmed" value={formatDate(b.utcConfirmedAt, 'long')} />
          )}
          {b.utcCancellationRequestedAt && (
            <Row
              label="Cancellation requested"
              value={formatDate(b.utcCancellationRequestedAt, 'long')}
            />
          )}
          {b.freeCancelDeadline && (
            <Row
              label="Free-cancel deadline"
              value={formatDate(b.freeCancelDeadline, 'long')}
            />
          )}
          {b.requestedInFreeWindow != null && (
            <Row
              label="Refund due"
              value={
                due ?? (
                  <span className="text-content-muted">
                    None (outside window)
                  </span>
                )
              }
            />
          )}
          <Row
            label="Public ref"
            value={<span className="font-mono text-xs">{b.publicRef}</span>}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
