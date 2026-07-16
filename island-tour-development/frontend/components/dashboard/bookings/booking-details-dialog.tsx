'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { BookingListItem } from '@/types/booking';
import { paymentModelLabel, refundDue } from './booking-columns';

function money(amount: string, rawCurrency: string): string {
  const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
  return formatPriceFrom(amount, currency, 'en');
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs font-semibold uppercase text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

/** Read-only quick view of everything the list row knows about a booking. */
export function BookingDetailsDialog({
  booking: b,
  open,
  onOpenChange,
}: {
  booking: BookingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const due = refundDue(b);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
            {b.displayRef}
          </DialogTitle>
          <DialogDescription>
            Booked {formatDate(b.createdAt, 'long')}
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y">
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
                  <span className="text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
