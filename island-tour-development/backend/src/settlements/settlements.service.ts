import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  Currency,
  PaymentModel,
  Prisma,
  Role,
  SettlementStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { localWallClockToUtc } from '@/common/utils/timezone.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import {
  settlementMethodFor,
  type ListSettlementsQueryDto,
  type ListSettlementsResponseDto,
  type SettlementListItemDto,
  type SettlementSummaryDto,
} from './dto/settlement.dto';

/** The booking fields the payout-window computation needs. */
type BookingWindow = {
  status: BookingStatus;
  tourStartDateTime: Date | null;
  tourTimeZone: string | null;
  // A pending cancellation request (requested, not yet actioned) holds the payout.
  utcCancellationRequestedAt: Date | null;
  utcCancelledAt: Date | null;
  tour: { cancellationHours: number } | null;
};

/**
 * Settlement payouts + the admin ledger read (master SETTLEMENT-AND-PAYOUTS §2, B4).
 *
 * v1 has no Stripe Connect, so the actual bank transfer is manual/batched. What is
 * automated here is the **release**: a scheduled sweep flips a `paid_in_full`
 * settlement RECORDED -> PAID_OUT once its booking's clawback (free-cancellation)
 * window has closed - the same deadline the refund path uses, so a payout is never
 * released while the traveler can still get a free refund. `status = PAID_OUT` means
 * "cleared to pay / released", with `operatorPayout` = the net owed; the funds move
 * against it manually in v1, automatically via Connect in v2.
 */
@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Free-cancellation deadline in real UTC = tourStart - cancellationHours, in the
   * booking's snapshotted zone. IDENTICAL formula to the TYP / refund path (guide
   * §14) so payout-release and refund-eligibility can never disagree. Null when the
   * booking has no start instant (cannot judge the window -> never auto-release).
   */
  private freeCancelDeadlineUtc(booking: BookingWindow): Date | null {
    if (!booking.tourStartDateTime) return null;
    const hours = booking.tour?.cancellationHours ?? 48;
    const local = new Date(
      booking.tourStartDateTime.getTime() - hours * 3_600_000,
    );
    return booking.tourTimeZone
      ? localWallClockToUtc(local, booking.tourTimeZone)
      : local;
  }

  /** Whether a settlement is a paid_in_full operator payout past its clawback window. */
  private isPayoutEligible(
    row: {
      status: SettlementStatus;
      paymentModel: PaymentModel;
      netPosition: Prisma.Decimal;
      booking: BookingWindow;
    },
    now: Date,
  ): boolean {
    if (row.status !== SettlementStatus.RECORDED) return false;
    if (row.paymentModel !== PaymentModel.PAID_IN_FULL) return false;
    if (!row.netPosition.greaterThan(0)) return false; // nothing owed to the operator
    // Only a booking that still stands: a cancelled/expired booking must never pay out.
    if (
      row.booking.status !== BookingStatus.CONFIRMED &&
      row.booking.status !== BookingStatus.REDEEMED
    ) {
      return false;
    }
    // Hold the payout while a cancellation request is pending (requested, not yet
    // actioned). Refund entitlement is judged at the REQUEST instant (master 6.4),
    // so a request made in-window still owes the traveler a refund even once an
    // admin processes it after the window closes. Paying the operator first would
    // leave IT unable to claw the money back. The hold lifts when the request is
    // resolved: cancelled -> status leaves CONFIRMED (never eligible); rejected ->
    // utcCancellationRequestedAt cleared, so this booking releases normally.
    if (
      row.booking.utcCancellationRequestedAt != null &&
      row.booking.utcCancelledAt == null
    ) {
      return false;
    }
    const deadline = this.freeCancelDeadlineUtc(row.booking);
    return deadline != null && now >= deadline;
  }

  /**
   * Scheduled release sweep (driven by the workers cron). Flips every eligible
   * `paid_in_full` settlement RECORDED -> PAID_OUT, stamping `operatorPayout` (= the
   * net owed) and `settledAt`. Idempotent + race-safe: the flip is a guarded
   * `updateMany` on `status: RECORDED`, so a re-run or a concurrent sweep never
   * double-releases. Clawback-safe: only released after the free-cancellation window.
   */
  async releaseEligiblePayouts(now: Date = new Date()): Promise<number> {
    const candidates = await this.prisma.settlement.findMany({
      where: {
        status: SettlementStatus.RECORDED,
        paymentModel: PaymentModel.PAID_IN_FULL,
        netPosition: { gt: 0 },
        booking: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
        },
      },
      select: {
        id: true,
        netPosition: true,
        paymentModel: true,
        status: true,
        booking: {
          select: {
            displayRef: true,
            status: true,
            tourStartDateTime: true,
            tourTimeZone: true,
            utcCancellationRequestedAt: true,
            utcCancelledAt: true,
            tour: { select: { cancellationHours: true } },
          },
        },
      },
    });

    let released = 0;
    for (const s of candidates) {
      if (!this.isPayoutEligible(s, now)) continue; // window still open
      const { count } = await this.prisma.settlement.updateMany({
        where: { id: s.id, status: SettlementStatus.RECORDED },
        data: {
          status: SettlementStatus.PAID_OUT,
          operatorPayout: s.netPosition,
          settledAt: now,
        },
      });
      if (count === 1) {
        released++;
        this.logger.log(
          `Settlement ${s.id} (${s.booking.displayRef}) released for payout: EUR ${s.netPosition.toString()}`,
        );
      }
    }
    if (released)
      this.logger.log(`Released ${released} settlement(s) for payout`);
    return released;
  }

  /**
   * Self-heal: void any settlement whose booking is CANCELLED/EXPIRED but whose
   * row is still RECORDED/INVOICED (i.e. still shows an operator-payout obligation).
   * The cancel path reverses inline, but this backstops (a) rows written before
   * the reversal logic existed, and (b) a race where the settlement is written
   * just after a cancel. Sets `status -> REVERSED`, `netPosition -> 0`,
   * `operatorPayout -> null`. A PAID_OUT row is left alone (money already moved =
   * a manual clawback in v1). Idempotent guarded updateMany. Runs on the cron.
   */
  async reverseStaleCancelledSettlements(): Promise<number> {
    const { count } = await this.prisma.settlement.updateMany({
      where: {
        status: {
          in: [SettlementStatus.RECORDED, SettlementStatus.INVOICED],
        },
        booking: {
          status: {
            in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED],
          },
        },
      },
      data: {
        status: SettlementStatus.REVERSED,
        netPosition: new Prisma.Decimal(0),
        operatorPayout: null,
      },
    });
    if (count)
      this.logger.log(`Reversed ${count} stale cancelled settlement(s)`);
    return count;
  }

  /**
   * Admin ledger list (dashboard). ADMIN sees every operator; a TOUR_OPERATOR is
   * scoped to their own rows. Filterable by operator/status/model + a createdAt day
   * range; each row carries the computed `payoutEligible` flag.
   */
  async list(
    query: ListSettlementsQueryDto,
    actor: { id: string; role: Role },
  ): Promise<ListSettlementsResponseDto> {
    assertDateRangeOrder(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.SettlementWhereInput = {};
    // Non-admins only ever see their own operator's settlements.
    if (actor.role !== Role.ADMIN) {
      where.operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
    } else if (query.operatorId) {
      where.operatorId = query.operatorId;
    }
    if (query.status) where.status = query.status;
    if (query.paymentModel) where.paymentModel = query.paymentModel;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from)
        where.createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) where.createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.settlement.count({ where }),
      this.prisma.settlement.findMany({
        where,
        // RECORDED (pending) first, then most-recent - the payout worklist on top.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookingId: true,
          operatorId: true,
          paymentModel: true,
          amountCollected: true,
          commissionOwed: true,
          netPosition: true,
          operatorPayout: true,
          status: true,
          currency: true,
          settledAt: true,
          createdAt: true,
          booking: {
            select: {
              displayRef: true,
              status: true,
              tourStartDateTime: true,
              tourTimeZone: true,
              utcCancellationRequestedAt: true,
              utcCancelledAt: true,
              tour: {
                select: { name: true, cancellationHours: true },
              },
              operator: {
                select: { companyInfo: { select: { companyName: true } } },
              },
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const data: SettlementListItemDto[] = rows.map((r) => {
      const window: BookingWindow = {
        status: r.booking.status,
        tourStartDateTime: r.booking.tourStartDateTime,
        tourTimeZone: r.booking.tourTimeZone,
        utcCancellationRequestedAt: r.booking.utcCancellationRequestedAt,
        utcCancelledAt: r.booking.utcCancelledAt,
        tour: r.booking.tour
          ? { cancellationHours: r.booking.tour.cancellationHours }
          : null,
      };
      // The payout release date (WHEN it settles) only applies to paid_in_full.
      const releaseAt =
        r.paymentModel === PaymentModel.PAID_IN_FULL
          ? this.freeCancelDeadlineUtc(window)
          : null;
      // A RECORDED payout with a pending cancellation request is HELD - the
      // release cron will skip it until the request is resolved (see
      // isPayoutEligible). Surfaced so the ledger shows "on hold" not "pending".
      const payoutHeld =
        r.status === SettlementStatus.RECORDED &&
        r.paymentModel === PaymentModel.PAID_IN_FULL &&
        r.netPosition.greaterThan(0) &&
        r.booking.utcCancellationRequestedAt != null &&
        r.booking.utcCancelledAt == null;
      return {
        id: r.id,
        bookingId: r.bookingId,
        displayRef: r.booking.displayRef,
        operatorId: r.operatorId,
        operatorName: r.booking.operator?.companyInfo?.companyName ?? null,
        tourName: r.booking.tour?.name ?? null,
        paymentModel: r.paymentModel,
        amountCollected: r.amountCollected.toString(),
        commissionOwed: r.commissionOwed.toString(),
        netPosition: r.netPosition.toString(),
        operatorPayout: r.operatorPayout?.toString() ?? null,
        status: r.status,
        currency: r.currency,
        settledAt: r.settledAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        payoutEligible: this.isPayoutEligible(
          {
            status: r.status,
            paymentModel: r.paymentModel,
            netPosition: r.netPosition,
            booking: window,
          },
          now,
        ),
        method: settlementMethodFor(r.paymentModel),
        payoutReleaseAt: releaseAt?.toISOString() ?? null,
        payoutHeld,
      };
    });

    return { total, page, limit, data };
  }

  /**
   * Roll-up for the settlements page header: how much is still owed out to
   * operators (paid_in_full nets not yet released) vs how much has been released.
   * Same operator-scoping as {@link list}.
   */
  async summary(actor: {
    id: string;
    role: Role;
  }): Promise<SettlementSummaryDto> {
    const scope: Prisma.SettlementWhereInput = {};
    if (actor.role !== Role.ADMIN) {
      scope.operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
    }

    const [owed, released] = await this.prisma.$transaction([
      this.prisma.settlement.aggregate({
        where: {
          ...scope,
          status: SettlementStatus.RECORDED,
          paymentModel: PaymentModel.PAID_IN_FULL,
          netPosition: { gt: 0 },
        },
        _sum: { netPosition: true },
        _count: true,
      }),
      this.prisma.settlement.aggregate({
        where: { ...scope, status: SettlementStatus.PAID_OUT },
        _sum: { operatorPayout: true },
        _count: true,
      }),
    ]);

    return {
      owedPending: (owed._sum.netPosition ?? new Prisma.Decimal(0)).toString(),
      owedCount: owed._count,
      released: (
        released._sum.operatorPayout ?? new Prisma.Decimal(0)
      ).toString(),
      releasedCount: released._count,
    };
  }
}
