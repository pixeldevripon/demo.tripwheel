// Unit tests for the Staff & Teams permission policy (src/config/staff.config.ts).
// This is the single source of truth for the effective-permission formula:
//
//   ((designation.permissions ∪ extraPermissions) − revokedPermissions)
//     ∩ scope ceiling  ∪  base floor
//
// Covers: suspended members, owner seats, the union/subtract formula, ceiling
// capping (platform + operator scopes), and the non-revocable base floor.

import { Permission, Role, StaffSeatRole, StaffStatus } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import {
  computeEffectivePermissions,
  EffectivePermissionParts,
  OPERATOR_SEAT_CEILING,
  PLATFORM_STAFF_CEILING,
  STAFF_BASE_PERMISSIONS,
} from '@/config/staff.config';

function makeParts(
  overrides: Partial<EffectivePermissionParts> = {},
): EffectivePermissionParts {
  return {
    operatorScoped: false,
    seatRole: StaffSeatRole.STAFF,
    status: StaffStatus.ACTIVE,
    designationPermissions: [],
    extraPermissions: [],
    revokedPermissions: [],
    ...overrides,
  };
}

describe('staff.config', () => {
  describe('ceiling constants', () => {
    it('PLATFORM_STAFF_CEILING never includes MANAGE_SYSTEM, MANAGE_STAFF, or MANAGE_TEAM', () => {
      expect(PLATFORM_STAFF_CEILING).not.toContain(Permission.MANAGE_SYSTEM);
      expect(PLATFORM_STAFF_CEILING).not.toContain(Permission.MANAGE_STAFF);
      expect(PLATFORM_STAFF_CEILING).not.toContain(Permission.MANAGE_TEAM);
    });

    it('PLATFORM_STAFF_CEILING is a subset of the ADMIN role set', () => {
      for (const p of PLATFORM_STAFF_CEILING) {
        expect(ROLE_PERMISSIONS[Role.ADMIN]).toContain(p);
      }
    });

    it('OPERATOR_SEAT_CEILING never includes MANAGE_TEAM or MANAGE_OPERATOR_PAYMENTS', () => {
      expect(OPERATOR_SEAT_CEILING).not.toContain(Permission.MANAGE_TEAM);
      expect(OPERATOR_SEAT_CEILING).not.toContain(
        Permission.MANAGE_OPERATOR_PAYMENTS,
      );
    });

    it('OPERATOR_SEAT_CEILING is a subset of the TOUR_OPERATOR role set', () => {
      for (const p of OPERATOR_SEAT_CEILING) {
        expect(ROLE_PERMISSIONS[Role.TOUR_OPERATOR]).toContain(p);
      }
    });

    it('STAFF_BASE_PERMISSIONS is exactly VIEW_PROFILE + EDIT_PROFILE', () => {
      expect([...STAFF_BASE_PERMISSIONS].sort()).toEqual(
        [Permission.VIEW_PROFILE, Permission.EDIT_PROFILE].sort(),
      );
    });
  });

  describe('computeEffectivePermissions', () => {
    it('returns an empty set when status is SUSPENDED, regardless of designation/extra permissions', () => {
      const result = computeEffectivePermissions(
        makeParts({
          status: StaffStatus.SUSPENDED,
          designationPermissions: [Permission.VIEW_TRIPS],
          extraPermissions: [Permission.MANAGE_TRIPS],
        }),
      );
      expect(result).toEqual([]);
    });

    it('returns the full TOUR_OPERATOR set for an OWNER seat', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: true,
          seatRole: StaffSeatRole.OWNER,
        }),
      );
      expect([...result].sort()).toEqual(
        [...ROLE_PERMISSIONS[Role.TOUR_OPERATOR]].sort(),
      );
    });

    it('an OWNER seat ignores revokedPermissions entirely', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: true,
          seatRole: StaffSeatRole.OWNER,
          revokedPermissions: [Permission.VIEW_TRIPS, Permission.EDIT_TRIP],
        }),
      );
      expect(result).toContain(Permission.VIEW_TRIPS);
      expect(result).toContain(Permission.EDIT_TRIP);
    });

    it('a non-OWNER seat within an operator scope does NOT get the full role set automatically', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: true,
          seatRole: StaffSeatRole.STAFF,
          designationPermissions: [Permission.VIEW_TRIPS],
        }),
      );
      // MANAGE_TEAM is part of the TOUR_OPERATOR role set but is never granted
      // to a non-owner seat because it sits outside the seat ceiling.
      expect(result).not.toContain(Permission.MANAGE_TEAM);
    });

    it('computes designationPermissions ∪ extraPermissions − revokedPermissions', () => {
      const result = computeEffectivePermissions(
        makeParts({
          designationPermissions: [Permission.VIEW_TRIPS, Permission.EDIT_TRIP],
          extraPermissions: [Permission.VIEW_BOOKINGS],
          revokedPermissions: [Permission.EDIT_TRIP],
        }),
      );
      expect(result).toContain(Permission.VIEW_TRIPS);
      expect(result).toContain(Permission.VIEW_BOOKINGS);
      expect(result).not.toContain(Permission.EDIT_TRIP);
    });

    it('caps platform staff: MANAGE_STAFF is never granted even via extraPermissions', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: false,
          extraPermissions: [Permission.MANAGE_STAFF, Permission.VIEW_TRIPS],
        }),
      );
      expect(result).not.toContain(Permission.MANAGE_STAFF);
      expect(result).toContain(Permission.VIEW_TRIPS);
    });

    it('caps platform staff: MANAGE_SYSTEM is never granted even via extraPermissions', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: false,
          extraPermissions: [Permission.MANAGE_SYSTEM],
        }),
      );
      expect(result).not.toContain(Permission.MANAGE_SYSTEM);
    });

    it('caps platform staff: MANAGE_TEAM is never granted even via the designation', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: false,
          designationPermissions: [Permission.MANAGE_TEAM],
        }),
      );
      expect(result).not.toContain(Permission.MANAGE_TEAM);
    });

    it('caps a non-owner seat: MANAGE_TEAM is never granted even via extraPermissions', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: true,
          seatRole: StaffSeatRole.STAFF,
          extraPermissions: [Permission.MANAGE_TEAM, Permission.VIEW_TRIPS],
        }),
      );
      expect(result).not.toContain(Permission.MANAGE_TEAM);
      expect(result).toContain(Permission.VIEW_TRIPS);
    });

    it('caps a non-owner seat: MANAGE_OPERATOR_PAYMENTS is never granted even via the designation', () => {
      const result = computeEffectivePermissions(
        makeParts({
          operatorScoped: true,
          seatRole: StaffSeatRole.MANAGER,
          designationPermissions: [Permission.MANAGE_OPERATOR_PAYMENTS],
        }),
      );
      expect(result).not.toContain(Permission.MANAGE_OPERATOR_PAYMENTS);
    });

    it('always includes the base floor (VIEW_PROFILE, EDIT_PROFILE) for an ACTIVE, non-owner member', () => {
      const result = computeEffectivePermissions(makeParts());
      expect(result).toContain(Permission.VIEW_PROFILE);
      expect(result).toContain(Permission.EDIT_PROFILE);
    });

    it('revoking a floor permission does not remove it - the floor is not revocable', () => {
      const result = computeEffectivePermissions(
        makeParts({
          revokedPermissions: [
            Permission.VIEW_PROFILE,
            Permission.EDIT_PROFILE,
          ],
        }),
      );
      expect(result).toContain(Permission.VIEW_PROFILE);
      expect(result).toContain(Permission.EDIT_PROFILE);
    });

    it('an INVITED member (not yet ACTIVE) still resolves the computed set (only SUSPENDED short-circuits)', () => {
      const result = computeEffectivePermissions(
        makeParts({
          status: StaffStatus.INVITED,
          designationPermissions: [Permission.VIEW_TRIPS],
        }),
      );
      expect(result).toContain(Permission.VIEW_TRIPS);
      expect(result).toContain(Permission.VIEW_PROFILE);
    });

    it('returns only the base floor when designation/extra are empty', () => {
      const result = computeEffectivePermissions(makeParts());
      expect([...result].sort()).toEqual([...STAFF_BASE_PERMISSIONS].sort());
    });
  });
});
