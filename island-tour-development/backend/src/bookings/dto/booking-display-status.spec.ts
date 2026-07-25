import { BookingStatus } from '@prisma/client';
import { deriveBookingDisplayStatus } from './booking.dto';

describe('deriveBookingDisplayStatus', () => {
  const at = (iso: string) => new Date(iso);

  it('layers CANCELLATION_REQUESTED on a CONFIRMED booking with a pending request', () => {
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CONFIRMED,
        utcCancellationRequestedAt: at('2026-07-19T10:00:00.000Z'),
        utcCancelledAt: null,
      }),
    ).toBe('CANCELLATION_REQUESTED');
  });

  it('returns the raw status once the cancellation is actually processed', () => {
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CANCELLED,
        utcCancellationRequestedAt: at('2026-07-19T10:00:00.000Z'),
        utcCancelledAt: at('2026-07-20T09:00:00.000Z'),
      }),
    ).toBe(BookingStatus.CANCELLED);
  });

  it('does not derive for a CONFIRMED booking with no request', () => {
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CONFIRMED,
        utcCancellationRequestedAt: null,
        utcCancelledAt: null,
      }),
    ).toBe(BookingStatus.CONFIRMED);
  });

  it('never re-labels a non-CONFIRMED status even with a request stamp', () => {
    // A request can only be stamped on a CONFIRMED booking, but the guard must
    // hold regardless: only CONFIRMED + pending flips.
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.REDEEMED,
        utcCancellationRequestedAt: at('2026-07-19T10:00:00.000Z'),
        utcCancelledAt: null,
      }),
    ).toBe(BookingStatus.REDEEMED);
  });

  // Non-payment forfeit lifecycle (guide s15).
  it('layers NON_PAYMENT_REPORTED on a CONFIRMED booking with a pending report', () => {
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CONFIRMED,
        utcCancellationRequestedAt: null,
        utcCancelledAt: null,
        utcNonPaymentReportedAt: at('2026-07-25T10:00:00.000Z'),
        utcForfeitedAt: null,
      }),
    ).toBe('NON_PAYMENT_REPORTED');
  });

  it('layers FORFEITED on a CANCELLED booking whose forfeit was confirmed', () => {
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CANCELLED,
        utcCancellationRequestedAt: null,
        utcCancelledAt: at('2026-07-26T09:00:00.000Z'),
        utcNonPaymentReportedAt: at('2026-07-25T10:00:00.000Z'),
        utcForfeitedAt: at('2026-07-26T09:00:00.000Z'),
      }),
    ).toBe('FORFEITED');
  });

  it('a pending cancellation request outranks a non-payment report', () => {
    // Both stamps can coexist; the traveller-initiated request is the one an
    // admin must act on first, so it wins the chip.
    expect(
      deriveBookingDisplayStatus({
        status: BookingStatus.CONFIRMED,
        utcCancellationRequestedAt: at('2026-07-25T09:00:00.000Z'),
        utcCancelledAt: null,
        utcNonPaymentReportedAt: at('2026-07-25T10:00:00.000Z'),
        utcForfeitedAt: null,
      }),
    ).toBe('CANCELLATION_REQUESTED');
  });
});
