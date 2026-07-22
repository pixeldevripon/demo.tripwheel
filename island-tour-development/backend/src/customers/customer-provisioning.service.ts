import { auth } from '@/auth/auth.instance';
import { TargetRateLimiter } from '@/bookings/lookup-rate-limiter';
import { ACTIVE_BOOKING_STATUSES } from '@/common/constants/booking-status';
import {
  getAccountUrl,
  provisionInvitedAccount,
} from '@/common/utils/invite-provisioning.util';
import { PrismaService } from '@/prisma/prisma.service';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';

/** The booking fields provisioning needs - a subset of any loaded booking row. */
export interface ProvisionableBooking {
  id: string;
  operatorId: string;
  contactEmail: string | null;
  contactFullName: string | null;
  contactFirstName: string | null;
}

/**
 * Turns a booking's contact into a customer account (master amendment
 * 2026-07-20, technical-doc/customers/CUSTOMER-ACCOUNTS.md):
 *
 * - findOrCreate a Role.USER auth account by contactEmail; a brand-new account
 *   gets the welcome email with the secure set-password link (Better Auth
 *   reset token via the auth.instance invite branch).
 * - backfill-link every booking with the same contactEmail (userId was null),
 *   so past guest bookings appear in the dashboard too.
 * - upsert `customers` rows (user x operator) and recompute their aggregates.
 *
 * Trust model: the account is inert until the emailed set-password link proves
 * mailbox ownership - the same basis as the public lookup/recover flow. Emails
 * that already belong to a NON-USER account (operator/staff/admin) are skipped
 * entirely: linking would inject bookings into their ops dashboards, and those
 * bookers keep the untouched publicRef flow.
 *
 * Every public method is fire-and-forget-safe: it never throws and must never
 * block or fail a booking, webhook, or cancellation. Call as
 * `void svc.provisionForBooking(booking)`.
 */
@Injectable()
export class CustomerProvisioningService {
  private readonly logger = new Logger(CustomerProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: TargetRateLimiter,
  ) {}

  async provisionForBooking(booking: ProvisionableBooking): Promise<void> {
    try {
      const email = booking.contactEmail?.toLowerCase().trim();
      if (!email) return;

      let user = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true, hasPassword: true },
      });

      if (user && user.role !== Role.USER) {
        this.logger.log(
          `Booking ${booking.id}: contact email belongs to a ${user.role} account - customer provisioning skipped`,
        );
        return;
      }

      if (!user) {
        user = await this.createCustomerAccount(email, booking);
        if (!user) return; // creation failed - logged inside
      } else if (!user.hasPassword) {
        // Booked again without ever setting a password: offer the link again,
        // capped so repeat bookings cannot spam the inbox.
        this.resendSetPasswordLink(email);
      }

      // Backfill-link this + every past booking with the same contact email.
      // The contact email is what identifies the customer, so we claim both
      // unowned bookings AND ones mis-stamped with a non-USER account: an
      // admin or operator logged into the browser at checkout used to be
      // recorded as the traveller (fixed at source in BookingsService.reserve,
      // but historical rows still carry it). Bookings already owned by a
      // different CUSTOMER account are never touched.
      const linked = await this.prisma.booking.updateMany({
        where: {
          contactEmail: { equals: email, mode: 'insensitive' },
          OR: [{ userId: null }, { user: { role: { not: Role.USER } } }],
        },
        data: { userId: user.id },
      });
      if (linked.count > 1) {
        this.logger.log(
          `Linked ${linked.count} booking(s) to customer ${user.id}`,
        );
      }

      // Steady state touches only the operator of THIS booking; the full
      // fan-out (every operator the customer ever booked with) runs only when
      // the backfill actually linked additional bookings - and in parallel.
      if (linked.count > 1) {
        const operators = await this.prisma.booking.findMany({
          where: { userId: user.id },
          select: { operatorId: true },
          distinct: ['operatorId'],
        });
        await Promise.all(
          operators.map(({ operatorId }) =>
            this.recomputeAggregates(user.id, operatorId),
          ),
        );
      } else {
        await this.recomputeAggregates(user.id, booking.operatorId);
      }
    } catch (err) {
      this.logger.error(
        `Customer provisioning failed for booking ${booking.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Recompute the (user x operator) customer row from the booking ledger:
   * CONFIRMED + REDEEMED bookings only, EUR value snapshot. Idempotent and
   * self-healing (no increment drift); also invoked after cancellations so
   * counts/spend never go stale. Never throws.
   */
  async recomputeAggregates(userId: string, operatorId: string): Promise<void> {
    try {
      const agg = await this.prisma.booking.aggregate({
        where: {
          userId,
          operatorId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
        _count: { _all: true },
        _sum: { totalEur: true },
        _min: { utcConfirmedAt: true, createdAt: true },
        _max: { utcConfirmedAt: true, createdAt: true },
      });
      const data = {
        // `createdAt` is the fallback because a booking can be CONFIRMED with no
        // confirmation stamp (imported or seeded rows), and an aggregate skips
        // nulls silently - so a customer whose every booking lacked one showed a
        // blank "Last booking" beside a count of 6, which reads as broken data.
        // Same precedence the tour's `lastBookedAt` already uses.
        firstBookingAt: agg._min.utcConfirmedAt ?? agg._min.createdAt,
        lastBookingAt: agg._max.utcConfirmedAt ?? agg._max.createdAt,
        bookingsCount: agg._count._all,
        totalSpendEur: agg._sum.totalEur ?? 0,
      };
      await this.prisma.customer.upsert({
        where: { userId_operatorId: { userId, operatorId } },
        create: { userId, operatorId, ...data },
        update: data,
      });
    } catch (err) {
      this.logger.error(
        `Customer aggregate recompute failed (user ${userId}, operator ${operatorId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Create the Role.USER account + fire the welcome (set-password) email.
   * A ConflictException means a concurrent caller won the race (settle vs
   * webhook) - refetch and continue without a second welcome.
   */
  private async createCustomerAccount(
    email: string,
    booking: ProvisionableBooking,
  ): Promise<{ id: string; role: Role; hasPassword: boolean } | null> {
    const name =
      booking.contactFullName?.trim() ||
      booking.contactFirstName?.trim() ||
      email.split('@')[0];
    try {
      const { user } = await provisionInvitedAccount(this.prisma, {
        email,
        name,
        role: Role.USER,
      });
      this.logger.log(
        `Customer account created for booking ${booking.id} (user ${user.id})`,
      );
      // Server-initiated (no request) -> auth.instance invite branch sends the
      // customer welcome email carrying the 1h set-password token. Seed the
      // per-email cap here too, so creation + resends together can never
      // exceed 1 send per 24h per address (server-initiated resets bypass
      // Better Auth's route-level limiter - this cap is the backstop).
      try {
        this.limiter.consume('customer-welcome', email, [
          { max: 1, windowMs: 24 * 60 * 60 * 1000 },
        ]);
        await auth.api.requestPasswordReset({
          body: { email, redirectTo: `${getAccountUrl()}/reset` },
        });
      } catch (err) {
        this.logger.warn(
          `Customer welcome email skipped for booking ${booking.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      return { id: user.id, role: Role.USER, hasPassword: false };
    } catch (err) {
      if (err instanceof ConflictException) {
        return this.prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, role: true, hasPassword: true },
        });
      }
      this.logger.error(
        `Customer account creation failed for booking ${booking.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  /** Re-send the set-password link, capped at 1 per email per 24h. */
  private resendSetPasswordLink(email: string): void {
    try {
      this.limiter.consume('customer-welcome', email, [
        { max: 1, windowMs: 24 * 60 * 60 * 1000 },
      ]);
    } catch {
      return; // cap hit - stay silent, they already have a fresh link
    }
    void auth.api
      .requestPasswordReset({
        body: { email, redirectTo: `${getAccountUrl()}/reset` },
      })
      .then(() => this.logger.log(`Set-password link re-sent to customer`))
      .catch((err) =>
        this.logger.error(
          'Customer set-password resend failed',
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }
}
