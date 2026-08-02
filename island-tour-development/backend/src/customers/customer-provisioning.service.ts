import { ACTIVE_BOOKING_STATUSES } from '@/common/constants/booking-status';
import { provisionOrAttachAccount } from '@/common/utils/invite-provisioning.util';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
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
 * Turns a booking's contact into a customer RECORD (master amendment
 * 2026-07-20, technical-doc/customers/CUSTOMER-ACCOUNTS.md):
 *
 * - findOrCreate a Role.USER auth account by contactEmail,
 * - backfill-link every booking with the same contactEmail (userId was null),
 *   so past guest bookings belong to that customer too,
 * - upsert `customers` rows (user x operator) and recompute their aggregates.
 *
 * NO EMAIL IS SENT (changed 2026-07-28). This used to mail a set-password
 * link, because travellers had a password-based `/account` door in the ops
 * dashboard. That door is gone: travellers are passwordless again and manage
 * their trips at `/{locale}/traveller` on the public site, signing in with a
 * one-time emailed code. The account created here is a CRM record - it gives
 * operators a customer to see and gives past bookings something to hang off -
 * and nobody ever signs into it.
 *
 * One account, many hats: emails that belong to a NON-USER account (operator/
 * staff) get the customer identity ATTACHED - their bookings link to the one
 * account. Their role is never touched. Only the hidden internal-management
 * account is skipped entirely.
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
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  async provisionForBooking(booking: ProvisionableBooking): Promise<void> {
    try {
      const email = booking.contactEmail?.toLowerCase().trim();
      if (!email) return;

      let user = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          role: true,
          hasPassword: true,
          isSystemAccount: true,
          customerOf: { select: { id: true }, take: 1 },
        },
      });

      if (user?.isSystemAccount) {
        this.logger.log(
          `Booking ${booking.id}: contact email belongs to an internal account - customer provisioning skipped`,
        );
        return;
      }

      const firstCustomerHat = !user || user.customerOf.length === 0;

      if (!user) {
        const provisioned = await this.createCustomerAccount(email, booking);
        if (!provisioned) return; // creation failed - logged inside
        user = { ...provisioned, isSystemAccount: false, customerOf: [] };
      }

      // Backfill-link this + every past booking with the same contact email.
      // The contact email is what identifies the customer, so we claim both
      // unowned bookings AND ones mis-stamped with a DIFFERENT account whose
      // email is not the contact email: an admin or operator logged into the
      // browser at checkout used to be recorded as the traveller (fixed at
      // source in BookingsService.reserve, but historical rows still carry
      // it). Bookings correctly owned by the account whose email IS the
      // contact email - including staff/operator accounts, which are now
      // legitimate booking owners - are never re-stamped away.
      const linked = await this.prisma.booking.updateMany({
        where: {
          contactEmail: { equals: email, mode: 'insensitive' },
          OR: [
            { userId: null },
            {
              userId: { not: user.id },
              user: {
                email: { not: { equals: email }, mode: 'insensitive' },
              },
            },
          ],
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
      // Scoped to ACTIVE statuses: the backfill links bookings by contact
      // email regardless of status, so an abandoned ON_HOLD/EXPIRED booking
      // with another operator must not drag that operator into the fan-out.
      if (linked.count > 1) {
        const operators = await this.prisma.booking.findMany({
          where: {
            userId: user.id,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
          },
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

      // A first customer row unions Role.USER's self-scoped permissions into
      // the account's effective set (staff-permissions.service) - drop the
      // 60s cache so a staff/operator booker can open /account immediately.
      if (firstCustomerHat) this.staffPermissions.invalidate(user.id);
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
   *
   * NEVER MINTS a row from an empty ledger. Without a confirmed booking there
   * was no successful payment, and without that there is no customer - so an
   * operator must not see one. This matters because the callers are not all
   * confirmation paths: `cancel` fires for any booking carrying a `userId`,
   * including an ON_HOLD hold that was never paid for, and a create-on-zero
   * would mint a 0-booking row for the operator whose tour was abandoned.
   * An EXISTING row is still updated to zero - a real customer who cancelled
   * their only booking keeps their history rather than silently vanishing.
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
      if (agg._count._all === 0) {
        await this.prisma.customer.updateMany({
          where: { userId, operatorId },
          data,
        });
        return;
      }
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
      const { user, created, hadPassword } = await provisionOrAttachAccount(
        this.prisma,
        {
          email,
          name,
          role: Role.USER,
        },
      );
      this.logger.log(
        `Customer account ${created ? 'created' : 'linked'} for booking ${booking.id} (user ${user.id})`,
      );
      // NO welcome / set-password email (2026-07-28). Travellers are
      // passwordless again: the account exists so operators have a customer
      // record and past bookings can be linked, but travellers never sign in
      // with a password. They manage their trips at `/{locale}/traveller` on
      // the public site, where the door is an emailed one-time code. Mailing
      // a set-password link would send them to a page that no longer exists
      // and invite a credential they have no use for.
      void created;
      return { id: user.id, role: Role.USER, hasPassword: hadPassword };
    } catch (err) {
      if (err instanceof ConflictException) {
        // Only the hidden internal-management account conflicts now - never
        // provision it as a customer.
        return null;
      }
      this.logger.error(
        `Customer account creation failed for booking ${booking.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }
}
