// Unit tests for StaffPermissionsService - the single place PermissionsGuard
// and GET /users/me/permissions consult for a user's effective permission set.
//
// Covers: the static-role short circuit (ADMIN/USER - no Prisma call), STAFF
// and TOUR_OPERATOR fallbacks when no staff_members row exists, the computed
// path for an actual member row, the 60s in-process cache (hit / invalidate /
// invalidateAll), and hasPermissions' missing-list contract.

import { Test, TestingModule } from '@nestjs/testing';
import { Permission, Role, StaffSeatRole, StaffStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import { STAFF_BASE_PERMISSIONS } from '@/config/staff.config';
import { StaffPermissionsService } from './staff-permissions.service';

function createMockPrismaService() {
  return {
    staffMember: {
      findUnique: jest.fn(),
    },
    // No customer rows by default - the multi-hat USER-perms union stays off.
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('StaffPermissionsService', () => {
  let service: StaffPermissionsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffPermissionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StaffPermissionsService>(StaffPermissionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getEffectivePermissions - static roles', () => {
    it('returns the static ROLE_PERMISSIONS set for ADMIN without hitting Prisma', async () => {
      const result = await service.getEffectivePermissions({
        id: 'admin-1',
        role: Role.ADMIN,
      });
      expect(result).toEqual(ROLE_PERMISSIONS[Role.ADMIN]);
      expect(prisma.staffMember.findUnique).not.toHaveBeenCalled();
    });

    it('returns the static ROLE_PERMISSIONS set for USER without hitting Prisma', async () => {
      const result = await service.getEffectivePermissions({
        id: 'user-1',
        role: Role.USER,
      });
      expect(result).toEqual(ROLE_PERMISSIONS[Role.USER]);
      expect(prisma.staffMember.findUnique).not.toHaveBeenCalled();
    });

    it('returns the static ROLE_PERMISSIONS set for EDITOR without hitting Prisma', async () => {
      const result = await service.getEffectivePermissions({
        id: 'editor-1',
        role: Role.EDITOR,
      });
      expect(result).toEqual(ROLE_PERMISSIONS[Role.EDITOR]);
      expect(prisma.staffMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getEffectivePermissions - STAFF/TOUR_OPERATOR without a staff row', () => {
    it('STAFF role with no staff_members row resolves to the base floor only', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(null);

      const result = await service.getEffectivePermissions({
        id: 'staff-1',
        role: Role.STAFF,
      });

      expect([...result].sort()).toEqual([...STAFF_BASE_PERMISSIONS].sort());
      // Must never fall back to the broad legacy static STAFF list.
      expect(result).not.toEqual(ROLE_PERMISSIONS[Role.STAFF]);
    });

    it('unions Role.USER permissions into a STAFF set when the account has customer rows (multi-hat)', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });

      const result = await service.getEffectivePermissions({
        id: 'staff-1',
        role: Role.STAFF,
      });

      for (const p of ROLE_PERMISSIONS[Role.USER]) {
        expect(result).toContain(p);
      }
      for (const p of STAFF_BASE_PERMISSIONS) {
        expect(result).toContain(p);
      }
    });

    it('TOUR_OPERATOR role with no staff_members row resolves to the full role set', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(null);

      const result = await service.getEffectivePermissions({
        id: 'operator-1',
        role: Role.TOUR_OPERATOR,
      });

      expect(result).toEqual(ROLE_PERMISSIONS[Role.TOUR_OPERATOR]);
    });
  });

  describe('getEffectivePermissions - computed path for a member row', () => {
    it('computes the effective set from the designation + overrides for a STAFF member', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [Permission.VIEW_BOOKINGS],
        revokedPermissions: [],
        designation: { permissions: [Permission.VIEW_TRIPS] },
      });

      const result = await service.getEffectivePermissions({
        id: 'staff-2',
        role: Role.STAFF,
      });

      expect(result).toContain(Permission.VIEW_TRIPS);
      expect(result).toContain(Permission.VIEW_BOOKINGS);
      expect(result).toContain(Permission.VIEW_PROFILE);
      expect(prisma.staffMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'staff-2' } }),
      );
    });

    it('computes an empty set for a SUSPENDED operator team seat', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op-1',
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.SUSPENDED,
        extraPermissions: [Permission.VIEW_TRIPS],
        revokedPermissions: [],
        designation: null,
      });

      const result = await service.getEffectivePermissions({
        id: 'seat-1',
        role: Role.TOUR_OPERATOR,
      });

      expect(result).toEqual([]);
    });

    it('resolves the full TOUR_OPERATOR set for an OWNER seat row', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op-1',
        seatRole: StaffSeatRole.OWNER,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const result = await service.getEffectivePermissions({
        id: 'owner-1',
        role: Role.TOUR_OPERATOR,
      });

      expect(result).toEqual(ROLE_PERMISSIONS[Role.TOUR_OPERATOR]);
    });
  });

  describe('cache behavior', () => {
    it('does not hit Prisma again on a second call within the TTL', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const user = { id: 'staff-3', role: Role.STAFF as Role };
      await service.getEffectivePermissions(user);
      await service.getEffectivePermissions(user);

      expect(prisma.staffMember.findUnique).toHaveBeenCalledTimes(1);
    });

    it('invalidate(userId) forces a recompute on the next call', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const user = { id: 'staff-4', role: Role.STAFF as Role };
      await service.getEffectivePermissions(user);
      service.invalidate('staff-4');
      await service.getEffectivePermissions(user);

      expect(prisma.staffMember.findUnique).toHaveBeenCalledTimes(2);
    });

    it('invalidate(userId) does not affect other users cached entries', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const userA = { id: 'staff-5', role: Role.STAFF as Role };
      const userB = { id: 'staff-6', role: Role.STAFF as Role };
      await service.getEffectivePermissions(userA);
      await service.getEffectivePermissions(userB);
      service.invalidate('staff-5');
      await service.getEffectivePermissions(userB);

      // userB's cached entry should still be warm - only 2 calls total
      // (one per user, none for the repeated userB lookup).
      expect(prisma.staffMember.findUnique).toHaveBeenCalledTimes(2);
    });

    it('invalidateAll() clears every cached entry', async () => {
      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const userA = { id: 'staff-7', role: Role.STAFF as Role };
      const userB = { id: 'staff-8', role: Role.STAFF as Role };
      await service.getEffectivePermissions(userA);
      await service.getEffectivePermissions(userB);
      service.invalidateAll();
      await service.getEffectivePermissions(userA);
      await service.getEffectivePermissions(userB);

      expect(prisma.staffMember.findUnique).toHaveBeenCalledTimes(4);
    });

    it('recomputes once the 60s TTL has elapsed', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      prisma.staffMember.findUnique.mockResolvedValue({
        operatorId: null,
        seatRole: StaffSeatRole.STAFF,
        status: StaffStatus.ACTIVE,
        extraPermissions: [],
        revokedPermissions: [],
        designation: null,
      });

      const user = { id: 'staff-9', role: Role.STAFF as Role };
      await service.getEffectivePermissions(user);

      jest.setSystemTime(new Date('2026-01-01T00:01:01.000Z')); // +61s
      await service.getEffectivePermissions(user);

      expect(prisma.staffMember.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasPermissions', () => {
    it('returns granted=true and an empty missing list when all required permissions are present', async () => {
      const result = await service.hasPermissions(
        { id: 'admin-2', role: Role.ADMIN },
        [Permission.VIEW_TRIPS, Permission.VIEW_PROFILE],
      );
      expect(result.granted).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns granted=false and lists the missing permissions', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(null);

      const result = await service.hasPermissions(
        { id: 'staff-10', role: Role.STAFF },
        [Permission.MANAGE_TRIPS, Permission.VIEW_PROFILE],
      );

      expect(result.granted).toBe(false);
      expect(result.missing).toEqual([Permission.MANAGE_TRIPS]);
    });
  });
});
