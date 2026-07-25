import {
  BookingStatus,
  CancellationRefund,
  PaymentKind,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { deriveRefundState } from './refund-state.util';

const D = (v: string) => new Prisma.Decimal(v);
const charge = (amount: string) => ({
  kind: PaymentKind.FULL,
  status: PaymentStatus.SUCCEEDED,
  amount: D(amount),
});
const refund = (amount: string) => ({
  kind: PaymentKind.REFUND,
  status: PaymentStatus.SUCCEEDED,
  amount: D(amount),
});

describe('deriveRefundState', () => {
  it('is NONE for a booking that is not cancelled', () => {
    expect(
      deriveRefundState([charge('695')], BookingStatus.CONFIRMED, null),
    ).toBe('NONE');
  });

  it('is NONE when the cancel verdict owes no refund (after window)', () => {
    expect(
      deriveRefundState(
        [charge('695')],
        BookingStatus.CANCELLED,
        CancellationRefund.NONE,
      ),
    ).toBe('NONE');
  });

  it('is PENDING when a full refund is owed but no REFUND row exists yet', () => {
    // The money is still held (Stripe off / no real charge) - must NOT read as refunded.
    expect(
      deriveRefundState(
        [charge('695')],
        BookingStatus.CANCELLED,
        CancellationRefund.FULL,
      ),
    ).toBe('PENDING');
  });

  it('is REFUNDED once the charge has actually been returned', () => {
    expect(
      deriveRefundState(
        [charge('695'), refund('695')],
        BookingStatus.CANCELLED,
        CancellationRefund.FULL,
      ),
    ).toBe('REFUNDED');
  });

  it('is PARTIAL when only some of the charge was returned', () => {
    expect(
      deriveRefundState(
        [charge('695'), refund('300')],
        BookingStatus.CANCELLED,
        CancellationRefund.FULL,
      ),
    ).toBe('PARTIAL');
  });

  it('is NONE when nothing was ever collected (on-arrival / operator model)', () => {
    expect(
      deriveRefundState([], BookingStatus.CANCELLED, CancellationRefund.FULL),
    ).toBe('NONE');
  });
});
