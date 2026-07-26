import {
  BookingStatus,
  CancellationRefund,
  PaymentKind,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export type RefundState = 'NONE' | 'PENDING' | 'PARTIAL' | 'REFUNDED';

/**
 * The TRUE refund state, read from the payment ledger - never assumed from the
 * cancellation verdict. A cancel marks a booking CANCELLED and *owes* a refund,
 * but the money only actually moves when `executeRefund` writes a settled
 * (REFUNDED) REFUND row (which is a no-op when Stripe is unconfigured or the
 * charge was never a real PaymentIntent). So a cancelled booking can sit
 * PENDING with the money still held - the dashboard must show that, not a
 * false "refunded". SUCCEEDED still counts as money-moved on both legs: the
 * original charge keeps it until the refund settles, and legacy REFUND rows
 * carry it from before refunds settled to REFUNDED.
 *
 * - NONE      : no refund owed (not cancelled, nothing collected, or an
 *               after-window NONE verdict).
 * - PENDING   : a refund is owed (FULL/PARTIAL verdict, money collected) but no
 *               SUCCEEDED REFUND row exists yet - money still with IT.
 * - PARTIAL   : some but not all of the collected amount has been refunded.
 * - REFUNDED  : the collected amount has been fully returned.
 */
export function deriveRefundState(
  payments: {
    kind: PaymentKind;
    status: PaymentStatus;
    amount: Prisma.Decimal;
  }[],
  status: BookingStatus,
  cancellationRefund: CancellationRefund | null,
): RefundState {
  if (status !== BookingStatus.CANCELLED) return 'NONE';
  if (
    cancellationRefund === CancellationRefund.NONE ||
    cancellationRefund == null
  )
    return 'NONE';
  let collected = new Prisma.Decimal(0);
  let refunded = new Prisma.Decimal(0);
  for (const p of payments) {
    // REFUNDED = money moved on both legs: a refunded original was still
    // COLLECTED at the time, and a settled REFUND row is money returned.
    if (
      p.status !== PaymentStatus.SUCCEEDED &&
      p.status !== PaymentStatus.REFUNDED
    )
      continue;
    if (p.kind === PaymentKind.REFUND) refunded = refunded.add(p.amount);
    else collected = collected.add(p.amount);
  }
  if (collected.lte(0)) return 'NONE'; // nothing was charged (on-arrival/operator)
  if (refunded.gte(collected)) return 'REFUNDED';
  if (refunded.gt(0)) return 'PARTIAL';
  return 'PENDING';
}
