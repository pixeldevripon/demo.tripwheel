import { PrismaService } from '@/prisma/prisma.service';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import {
  computeEffectivePermissions,
  STAFF_BASE_PERMISSIONS,
} from '@/config/staff.config';
import { Injectable } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';

/**
 * Resolves a user's EFFECTIVE permission set - the one source consulted by
 * PermissionsGuard and by `GET /users/me/permissions`.
 *
 * - ADMIN / EDITOR / GUIDE / USER: the static ROLE_PERMISSIONS map, unchanged.
 * - TOUR_OPERATOR: owners (the Operator.userId account or an OWNER seat) keep
 *   the full role set; non-owner seats get the computed staff set capped to
 *   OPERATOR_SEAT_CEILING.
 * - STAFF: platform staff get the computed set capped to PLATFORM_STAFF_CEILING.
 *   A STAFF-role user WITHOUT a staff_members row gets the base floor ONLY -
 *   never the legacy static STAFF list. This closes the escalation path where a
 *   user-manager flips an accomplice's role to STAFF to hand them the broad
 *   static set without any admin ever assigning permissions.
 * - SUSPENDED members resolve to an empty set (their sessions are also revoked
 *   on suspension; this covers the race until the cache below expires).
 *
 * Results are cached in-process for CACHE_TTL_MS; every staff mutation calls
 * `invalidate(userId)` so changes apply immediately in the same process.
 */
@Injectable()
export class StaffPermissionsService {
  private static readonly CACHE_TTL_MS = 60_000;
  private readonly cache = new Map<
    string,
    { permissions: Permission[]; expiresAt: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /** Drop one user's cached permission set (call after any staff mutation). */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /** Drop every cached set (designation permission edits affect many users). */
  invalidateAll(): void {
    this.cache.clear();
  }

  async getEffectivePermissions(user: {
    id: string;
    role: Role;
  }): Promise<Permission[]> {
    // Only these two roles can be staff-managed; everyone else is static.
    if (user.role !== Role.STAFF && user.role !== Role.TOUR_OPERATOR) {
      return ROLE_PERMISSIONS[user.role] ?? [];
    }

    const cached = this.cache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const permissions = await this.compute(user.id, user.role);
    this.cache.set(user.id, {
      permissions,
      expiresAt: Date.now() + StaffPermissionsService.CACHE_TTL_MS,
    });
    return permissions;
  }

  async hasPermissions(
    user: { id: string; role: Role },
    required: Permission[],
  ): Promise<{ granted: boolean; missing: Permission[] }> {
    const effective = await this.getEffectivePermissions(user);
    const missing = required.filter((p) => !effective.includes(p));
    return { granted: missing.length === 0, missing };
  }

  private async compute(userId: string, role: Role): Promise<Permission[]> {
    const member = await this.prisma.staffMember.findUnique({
      where: { userId },
      select: {
        operatorId: true,
        seatRole: true,
        status: true,
        extraPermissions: true,
        revokedPermissions: true,
        designation: { select: { permissions: true } },
      },
    });

    if (!member) {
      if (role === Role.TOUR_OPERATOR) {
        // Not a seat: either the operator account itself (pre-backfill /
        // legacy) or an operator-less user who fails resolveOperatorId anyway.
        return ROLE_PERMISSIONS[Role.TOUR_OPERATOR];
      }
      // STAFF role without a staff record: floor only (see class JSDoc).
      return [...STAFF_BASE_PERMISSIONS];
    }

    return computeEffectivePermissions({
      operatorScoped: member.operatorId !== null,
      seatRole: member.seatRole,
      status: member.status,
      designationPermissions: member.designation?.permissions ?? [],
      extraPermissions: member.extraPermissions,
      revokedPermissions: member.revokedPermissions,
    });
  }
}
