import { BadRequestException } from '@nestjs/common';
import { Role, StaffStatus } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Roles that read platform-wide rather than through an operator scope. The
 * permission guard decides IF a caller may read at all (`VIEW_BOOKINGS`,
 * `VIEW_TRIPS`, `VIEW_REVIEWS`, ...); this decides WHOSE rows they get.
 *
 * Lives here beside `resolveOperatorId` because it is the exact complement of
 * it: a platform-wide role has no operator record to resolve, so routing one
 * through resolution 400s them out of data they are entitled to.
 *
 * THIS IS NOT "is the caller an ADMIN". Platform STAFF and EDITOR sit on the
 * same side of the line, and testing for ADMIN alone is what left an invited
 * Operations Manager staring at empty Tours, Reviews and Settlements screens
 * (test report 2026-08-01 §Admin.4) - each one had sent them down the operator
 * branch, where resolution throws "No operator profile found".
 */
export function isPlatformWideRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF || role === Role.EDITOR;
}

/**
 * The booking/payment-flavoured name for the same predicate, kept because
 * `BookingsService` and `PaymentsService` read better with it. One
 * implementation, so the two can never drift.
 */
export function isPlatformWideBookingRole(role: Role): boolean {
  return isPlatformWideRole(role);
}

/**
 * Resolves a user's `operator.id` (ownership key for tours, availability, bookings).
 *
 * Tour-domain ownership is keyed on `operators.id`, never `users.id` (master rule #19).
 * Resolution order:
 *   1. The operator account itself (`Operator.userId`) - the owner.
 *   2. An ACTIVE team seat (`staff_members.operatorId`) - staff/manager seats
 *      resolve to their operator's id, so every ownership check downstream
 *      scopes them to that operator's rows (login doc Phase 2 item 3).
 *      Suspended seats do NOT resolve.
 *   3. An `ADMIN` with neither is auto-provisioned an operator record on first
 *      use (admins bypass per-row ownership elsewhere).
 * A `TOUR_OPERATOR` with none of the above must finish registration.
 */
export async function resolveOperatorId(
  prisma: PrismaService,
  userId: string,
  role?: Role,
): Promise<string> {
  const operator = await prisma.operator.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (operator) return operator.id;

  const seat = await prisma.staffMember.findUnique({
    where: { userId },
    select: { operatorId: true, status: true },
  });
  if (seat?.operatorId && seat.status !== StaffStatus.SUSPENDED) {
    return seat.operatorId;
  }

  if (role === Role.ADMIN) {
    const created = await prisma.operator.create({
      data: { userId },
      select: { id: true },
    });
    return created.id;
  }

  throw new BadRequestException(
    'No operator profile found. Please complete your operator registration first.',
  );
}
