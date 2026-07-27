'use client';

/**
 * Read-only quick view of everything the customers list knows about one
 * customer. Opened by a row click; the trimmed list columns (last booking,
 * reviews) live here in full alongside the visible ones.
 */

import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/common/status-badge';
import { CUSTOMER_TIER, customerTier } from '@/components/common/status-maps';
import {
  MoneyRow,
  Row,
  Section,
  SheetPager,
  type SheetPagerProps,
} from '@/components/common/detail-sheet';
import type { CustomerListItem } from '@/types/customer';

/** `2026-07-18T…` -> `18 Jul 2026`. Dashes for an absent date, never "Invalid". */
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

/** "3 days ago" beside the date - saves the reader the arithmetic. */
function relativeDays(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

/** `Anna Meijer` -> `AM`; falls back to the email so a nameless row still reads. */
function initials(name: string | null, email: string): string {
  const source = (name ?? email.split('@')[0]).trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Lifetime spend is EUR-normalized on the server, so the symbol is fixed. */
const eur = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function dateWithAgo(iso: string | null): React.ReactNode {
  const ago = relativeDays(iso);
  return (
    <>
      {shortDate(iso)}
      {ago ? <span className="text-content-muted"> · {ago}</span> : null}
    </>
  );
}

export function CustomerDetailSheet({
  customer: c,
  onOpenChange,
  ...pager
}: {
  customer: CustomerListItem | null;
  onOpenChange: (open: boolean) => void;
} & SheetPagerProps) {
  return (
    <Sheet open={c !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl!">
        {c && <CustomerDetailBody customer={c} {...pager} />}
      </SheetContent>
    </Sheet>
  );
}

function CustomerDetailBody({
  customer: c,
  onPrev,
  onNext,
  position,
}: { customer: CustomerListItem } & SheetPagerProps) {
  const tier = CUSTOMER_TIER[customerTier(c.bookingsCount)];
  const spend = Number(c.totalSpendEur);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      toast.success('Email address copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="text-xs font-medium">
                {initials(c.name, c.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <SheetTitle className="truncate">{c.name ?? '—'}</SheetTitle>
                <StatusBadge variant={tier.variant} hint={tier.hint}>
                  {tier.label}
                </StatusBadge>
              </div>
              <SheetDescription className="truncate">
                {c.email}
              </SheetDescription>
            </div>
          </div>
          <SheetPager onPrev={onPrev} onNext={onNext} position={position} />
        </div>
      </SheetHeader>

      <div className="flex-1 divide-y overflow-y-auto px-4">
        <Section label="Contact">
          <Row
            label="Email"
            value={
              <a
                href={`mailto:${c.email}`}
                className="hover:underline underline-offset-4"
              >
                {c.email}
              </a>
            }
          />
          {c.operatorName && <Row label="Operator" value={c.operatorName} />}
        </Section>

        <Section label="Bookings">
          <Row
            label="Total bookings"
            value={<span className="tabular-nums font-medium">{c.bookingsCount}</span>}
          />
          <Row label="First booking" value={dateWithAgo(c.firstBookingAt)} />
          <Row label="Last booking" value={dateWithAgo(c.lastBookingAt)} />
          <div className="mt-2 divide-y rounded-lg border bg-muted/30">
            <MoneyRow
              label="Lifetime spend (EUR)"
              value={Number.isFinite(spend) ? eur.format(spend) : '—'}
              strong
            />
          </div>
        </Section>

        <Section label="Reviews">
          <Row
            label="Reviews left"
            value={<span className="tabular-nums">{c.reviewsLeft}</span>}
          />
          <Row
            label="Awaiting a review"
            value={
              c.awaitingReview > 0 ? (
                <StatusBadge variant="warning">
                  {c.awaitingReview} trip
                  {c.awaitingReview === 1 ? '' : 's'} waiting
                </StatusBadge>
              ) : (
                <span className="text-content-muted">All caught up</span>
              )
            }
          />
        </Section>

        <Section label="Actions">
          <Button variant="outline" size="sm" onClick={copyEmail}>
            Copy email address
          </Button>
        </Section>
      </div>
    </>
  );
}
