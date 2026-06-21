import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Resolves a user's `operator.id` (ownership key for tours, availability, bookings).
 *
 * Tour-domain ownership is keyed on `operators.id`, never `users.id` (master rule #19).
 * An `ADMIN` with no operator record is auto-provisioned one on first use (admins bypass
 * per-row ownership elsewhere); a `TOUR_OPERATOR` without one must finish registration.
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
