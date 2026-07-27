'use client';

/**
 * Read-only quick view of everything the payments list knows about one
 * payment. Opened by a row click; the trimmed list columns (created, and the
 * settlement columns dropped earlier) live here in full alongside the visible
 * ones.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon } from '@hugeicons/core-free-icons';
import Link from 'next/link';
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
import {
  PAYMENT_STATUS,
  SETTLEMENT_METHOD_LABEL,
  SETTLEMENT_STATUS,
} from '@/components/common/status-maps';
import {
  MoneyRow,
  Row,
  Section,
  SheetPager,
  type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { formatDate } from '@/lib/utils';
import { paymentModelLabel } from '@/lib/bookings/format';
import type { PaymentListItem } from '@/types/booking';
import { kindLabel, money } from './payment-columns';

export function PaymentDetailSheet({
  payment: p,
  onOpenChange,
  ...pager
}: {
  payment: PaymentListItem | null;
  onOpenChange: (open: boolean) => void;
} & SheetPagerProps) {
  return (
    <Sheet open={p !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl!">
        {p && <PaymentDetailBody payment={p} {...pager} />}
      </SheetContent>
    </Sheet>
  );
}

function PaymentDetailBody({
  payment: p,
  onPrev,
  onNext,
  position,
}: { payment: PaymentListItem } & SheetPagerProps) {
  const statusMeta = PAYMENT_STATUS[p.status];

  const copy = (value: string, message: string) => async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="tabular-nums">
                {money(p.amount, p.currency)}
              </SheetTitle>
              <StatusBadge variant={statusMeta.variant} hint={statusMeta.hint}>
                {statusMeta.label}
              </StatusBadge>
            </div>
            <SheetDescription>
              {kindLabel[p.kind]} · {formatDate(p.createdAt, 'long')}
            </SheetDescription>
          </div>
          <SheetPager onPrev={onPrev} onNext={onNext} position={position} />
        </div>
      </SheetHeader>

      <div className="flex-1 divide-y overflow-y-auto px-4">
        <Section label="Payment">
          <div className="mb-2 divide-y rounded-lg border bg-muted/30">
            <MoneyRow label="Amount" value={money(p.amount, p.currency)} strong />
          </div>
          <Row label="Kind" value={kindLabel[p.kind]} />
          <Row
            label="Provider"
            value={<span className="capitalize">{p.provider.toLowerCase()}</span>}
          />
          <Row label="Method" value={p.methodType ?? '-'} />
          {p.intentId && (
            <Row
              label="Provider reference"
              value={
                <span className="inline-flex max-w-full items-center gap-1">
                  <span className="min-w-0 break-all font-mono text-xs">
                    {p.intentId}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy provider reference"
                    onClick={copy(p.intentId, 'Payment reference copied')}
                    className="shrink-0 text-content-muted hover:text-foreground"
                  >
                    <HugeiconsIcon icon={Copy01Icon} />
                  </Button>
                </span>
              }
            />
          )}
        </Section>

        <Section label="Booking">
          <Row
            label="Reference"
            value={<span className="font-mono">{p.bookingDisplayRef}</span>}
          />
          <Row
            label="Guest"
            value={
              p.contactFullName ? (
                <Link
                  href={`/customers?q=${encodeURIComponent(p.contactFullName)}`}
                  className="hover:underline underline-offset-4"
                >
                  {p.contactFullName}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <Row label="Tour" value={p.tourName} />
          <Row label="Travel date" value={formatDate(p.bookingLocalDate)} />
          <Row label="Payment model" value={paymentModelLabel[p.paymentModel]} />
        </Section>

        <Section label="Settlement">
          <Row
            label="Status"
            value={
              p.settlementStatus ? (
                <StatusBadge
                  variant={SETTLEMENT_STATUS[p.settlementStatus].variant}
                  hint={SETTLEMENT_STATUS[p.settlementStatus].hint}
                >
                  {SETTLEMENT_STATUS[p.settlementStatus].label}
                </StatusBadge>
              ) : (
                <span className="text-content-muted">Not applicable yet</span>
              )
            }
          />
          <Row label="Method" value={SETTLEMENT_METHOD_LABEL[p.settlementMethod]} />
          {p.settlementHeld && (
            <Row
              label="Payout"
              value={
                <StatusBadge variant="warning">
                  On hold - cancellation pending
                </StatusBadge>
              }
            />
          )}
        </Section>

        <Section label="Timeline">
          <Row label="Created" value={formatDate(p.createdAt, 'long')} />
          <Row label="Last updated" value={formatDate(p.updatedAt, 'long')} />
        </Section>

        <Section label="Reference">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-all font-mono text-xs">
              {p.bookingPublicRef}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy booking public ref"
              onClick={copy(p.bookingPublicRef, 'Public ref copied')}
              className="shrink-0 text-content-muted hover:text-foreground"
            >
              <HugeiconsIcon icon={Copy01Icon} />
            </Button>
          </div>
        </Section>
      </div>
    </>
  );
}
