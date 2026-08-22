// DEMO SEED — operator-payout settlements. Mirrors the live write rule exactly
// (founder 2026-07-26): a ledger row exists ONLY for paid_in_full bookings - the
// one model where Island Tours holds money it owes the operator. Deposit models
// are self-settling and get NO row. Statuses are seeded to demo every real
// state the dashboard can show:
//   RECORDED  - payout due (future bookings still inside their clawback window
//               AND recently-redeemed ones sitting on the "ready to pay" worklist)
//   PAID_OUT  - older redeemed bookings an admin already paid (settledAt stamped)
//   REVERSED  - cancelled bookings: the obligation was voided, net -> 0
//
// Additive-only, like the bookings themselves: a booking that already has a
// ledger row keeps it untouched (an admin may have marked it paid by hand).

import {
  BookingStatus,
  PaymentModel,
  Prisma,
  SettlementStatus,
} from '@prisma/client';
import { D, DEMO_TOUR_REF, log, money, prisma, section } from './_shared';

/** Redeemed longer ago than this = the admin has already paid it out (demo). */
const PAID_OUT_AFTER_DAYS = 7;

/**
 * Repair demo bookings written before the depth top-up set commission fields.
 * A REDEEMED/CONFIRMED booking with a null `commissionAmount` is corruption by
 * rule #22 - commission aggregates and this ledger both depend on it. Same
 * self-healing pattern as `repairMoneylessBookings` (reviews.ts): scoped to
 * DEMO tours only, idempotent (the predicate is unsatisfiable once fixed).
 */
async function repairCommissionlessBookings(): Promise<void> {
  const broken = await prisma.booking.findMany({
    where: {
      tour: { reference: DEMO_TOUR_REF },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
      commissionAmount: null,
      totalEur: { not: null },
    },
    select: {
      id: true,
      totalEur: true,
      tour: { select: { commissionTier: true } },
    },
  });
  if (broken.length === 0) return;

  for (const b of broken) {
    const rate = b.tour.commissionTier.dividedBy(100).toDecimalPlaces(4);
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        commissionRate: rate,
        commissionAmount: money(D(b.totalEur ?? 0).times(rate)),
      },
    });
  }
  log(
    `Repaired ${broken.length} booking(s) that carried no commission snapshot.`,
  );
}

export async function seedSettlements(): Promise<void> {
  section('Settlements (operator payouts)');

  await repairCommissionlessBookings();

  const bookings = await prisma.booking.findMany({
    where: {
      tour: { reference: DEMO_TOUR_REF },
      paymentModel: PaymentModel.PAID_IN_FULL,
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.REDEEMED,
          BookingStatus.CANCELLED,
        ],
      },
      settlement: null, // additive: never touch an existing ledger row
    },
    select: {
      id: true,
      operatorId: true,
      status: true,
      totalEur: true,
      commissionAmount: true,
      utcConfirmedAt: true,
      utcRedeemedAt: true,
    },
  });

  if (bookings.length === 0) {
    log(
      'Settlements: every paid_in_full demo booking has its row — nothing to add.',
    );
    return;
  }

  const now = Date.now();
  let recorded = 0;
  let paidOut = 0;
  let reversed = 0;

  for (const b of bookings) {
    const { commissionAmount, totalEur } = b;
    if (commissionAmount == null || totalEur == null) {
      log(
        `Settlements: skipping ${b.id} (null commission/totalEur — corruption case).`,
      );
      continue;
    }
    const collected = money(totalEur);
    const commission = money(commissionAmount);
    const net = money(collected.minus(commission));

    let status: SettlementStatus = SettlementStatus.RECORDED;
    let netPosition: Prisma.Decimal = net;
    let operatorPayout: Prisma.Decimal | null = null;
    let settledAt: Date | null = null;

    if (b.status === BookingStatus.CANCELLED) {
      // Cancelled + refunded: the payout obligation is voided; the collected/
      // commission figures stay as the historical audit trail.
      status = SettlementStatus.REVERSED;
      netPosition = D(0);
      reversed++;
    } else if (
      b.status === BookingStatus.REDEEMED &&
      b.utcRedeemedAt &&
      now - b.utcRedeemedAt.getTime() > PAID_OUT_AFTER_DAYS * 86_400_000
    ) {
      // Old completed tours: the admin already transferred + marked them paid.
      status = SettlementStatus.PAID_OUT;
      operatorPayout = net;
      settledAt = new Date(b.utcRedeemedAt.getTime() + 3 * 86_400_000);
      paidOut++;
    } else {
      // Payout due: upcoming confirmed bookings (window still open) and
      // recently-redeemed ones (eligible — the admin's "ready to pay" worklist).
      recorded++;
    }

    await prisma.settlement.create({
      data: {
        bookingId: b.id,
        operatorId: b.operatorId,
        paymentModel: PaymentModel.PAID_IN_FULL,
        amountCollected: collected,
        commissionOwed: commission,
        netPosition,
        operatorPayout,
        status,
        settledAt,
        createdAt: b.utcConfirmedAt ?? new Date(),
      },
    });
  }

  log(
    `Settlements: ${recorded} payout due + ${paidOut} paid out + ${reversed} reversed (paid_in_full bookings only).`,
  );
}
