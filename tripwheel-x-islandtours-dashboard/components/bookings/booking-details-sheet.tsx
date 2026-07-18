'use client';

/**
 * Read-only quick view of everything the list row knows about a booking
 * (Phase 20) - a side sheet with prev/next arrows so an admin can walk a
 * page of bookings row-to-row without re-opening from the table each time.
 *
 * Enhanced single view (Phase 24): grouped sections (Trip / Guest / Payment /
 * Timeline / Reference) with micro-labels, a status badge in the header, a
 * boxed money summary, and a copyable public ref - instead of one flat list.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Copy01Icon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';
import { BOOKING_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { bookingMoney as money, paymentModelLabel, refundDue } from '@/lib/bookings/format';
import type { BookingListItem } from '@/types/booking';

/** Micro-label section wrapper - mirrors the sidebar group-label style. */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-2">
      <p className="m-0 mb-2 text-2xs font-semibold uppercase tracking-caps text-content-muted">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-xs text-content-muted shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

/** One line of the boxed money summary. */
function MoneyRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span
        className={
          strong ? 'text-sm font-medium' : 'text-xs text-content-muted'
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? 'text-sm font-semibold' : 'text-sm'}`}
      >
        {value}
      </span>
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
  const statusMeta = BOOKING_STATUS[b.status];

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(b.publicRef);
      toast.success('Public ref copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full sm:max-w-2xl! flex-col gap-0">
        <SheetHeader className="border-b">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <SheetTitle className="font-mono">{b.displayRef}</SheetTitle>
                <StatusBadge variant={statusMeta.variant}>
                  {statusMeta.label}
                </StatusBadge>
              </div>
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

        <div className="flex-1 divide-y overflow-y-auto px-4">
          <Section label="Trip">
            <p className="m-0 mb-1.5 text-sm font-medium">{b.tourName}</p>
            <Row
              label="Travel date"
              value={`${formatDate(b.localDate)}${b.startTime ? ` · ${b.startTime}` : ''}`}
            />
            <Row label="Party size" value={b.partySize} />
          </Section>

          <Section label="Guest">
            <Row label="Name" value={b.contactFullName ?? '-'} />
            <Row
              label="Email"
              value={
                b.contactEmail ? (
                  <a
                    href={`mailto:${b.contactEmail}`}
                    className="hover:underline underline-offset-4"
                  >
                    {b.contactEmail}
                  </a>
                ) : (
                  '-'
                )
              }
            />
          </Section>

          <Section label="Payment">
            <Row label="Model" value={paymentModelLabel[b.paymentModel]} />
            <div className="mt-2 divide-y rounded-lg border bg-muted/30">
              <MoneyRow label="Total" value={money(b.totalRetail, b.currency)} strong />
              <MoneyRow label="Deposit" value={money(b.depositAmount, b.currency)} />
              <MoneyRow label="Balance" value={money(b.balanceAmount, b.currency)} />
              {b.commissionAmount != null && (
                <MoneyRow
                  label={`Commission${
                    b.commissionRate != null
                      ? ` (${(Number(b.commissionRate) * 100).toFixed(1)}%)`
                      : ''
                  }`}
                  value={money(b.commissionAmount, b.currency)}
                />
              )}
            </div>
          </Section>

          <Section label="Timeline">
            <Row label="Booked" value={formatDate(b.createdAt, 'long')} />
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
          </Section>

          <Section label="Reference">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-all font-mono text-xs">
                {b.publicRef}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy public ref"
                onClick={copyRef}
                className="shrink-0 text-content-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={Copy01Icon} />
              </Button>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
