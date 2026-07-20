import { BadRequestException } from '@nestjs/common';
import { Role, StaffStatus } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Roles that read booking/payment rows platform-wide rather than through an
 * operator scope. The permission guard decides IF a caller may read at all
 * (`VIEW_BOOKINGS` / `VIEW_PAYMENTS`); this decides how the query is scoped.
 *
 * Lives here beside `resolveOperatorId` because it is the exact complement of
 * it: a platform-wide role has no operator record to resolve, so routing one
 * through resolution would 400 them out of data they are entitled to. Shared
 * by `BookingsService` and `PaymentsService` so the two cannot drift.
 */
export function isPlatformWideBookingRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF || role === Role.EDITOR;
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
