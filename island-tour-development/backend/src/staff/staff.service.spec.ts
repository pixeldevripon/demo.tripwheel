// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (same approach as operators.service.spec.ts).
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: jest.fn() },
      internalAdapter: {
        createUser: jest.fn(),
        linkAccount: jest.fn(),
        deleteUser: jest.fn(),
      },
    }),
    api: { requestPasswordReset: jest.fn() },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Permission,
  Prisma,
  Role,
  StaffSeatRole,
  StaffStatus,
  UserStatus,
} from '@prisma/client';
import { InboxService } from '@/inbox/inbox.service';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { auth } from '@/auth/auth.instance';
import type { TypedAuthUser } from '@/auth/auth.types';
import { StaffPermissionsService } from './staff-permissions.service';
import { StaffService } from './staff.service';

// This file intentionally does NOT deep-test the Better Auth invite
// plumbing (password hashing internals, reset-email templates, etc.) - only
// that provisionMember calls the right auth.$context/auth.api hooks and
// rolls back on failure. See staff.config.spec.ts for the permission-policy
// formula and staff-permissions.service.spec.ts for the cache/guard path.

function createMockPrismaService() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    staffMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    staffDesignation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    operator: { findUnique: jest.fn() },
    session: { deleteMany: jest.fn() },
  };
}

function createMockStaffPermissionsService() {
  return { invalidate: jest.fn(), invalidateAll: jest.fn() };
}

function makeActor(overrides: Partial<TypedAuthUser> = {}): TypedAuthUser {
  return { id: 'actor-1', role: Role.ADMIN, ...overrides } as TypedAuthUser;
}

function makeMemberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    operatorId: null as string | null,
    seatRole: StaffSeatRole.STAFF,
    status: StaffStatus.ACTIVE,
    extraPermissions: [] as Permission[],
    revokedPermissions: [] as Permission[],
    invitedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: null as Date | null,
    lastLoginAt: null as Date | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    user: {
      id: 'user-1',
      name: 'Jane Smith',
      email: 'jane@islandtours.com',
      image: null,
      status: UserStatus.ACTIVE,
    },
    designation: null as {
      id: string;
      name: string;
      permissions: Permission[];
    } | null,
    invitedBy: null as { id: string; name: string } | null,
    ...overrides,
  };
}

function makeDesignationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'designation-1',
    operatorId: null as string | null,
    name: 'Operations Manager',
    description: null as string | null,
    permissions: [Permission.VIEW_TRIPS] as Permission[],
    isSystem: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { members: 0 },
    ...overrides,
  };
}

describe('StaffService', () => {
  let service: StaffService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let staffPermissions: ReturnType<typeof createMockStaffPermissionsService>;
  let mailService: { sendHatAddedEmail: jest.Mock };
  let authCtx: {
    password: { hash: jest.Mock };
    internalAdapter: {
      createUser: jest.Mock;
      linkAccount: jest.Mock;
      deleteUser: jest.Mock;
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = createMockPrismaService();
    staffPermissions = createMockStaffPermissionsService();

    authCtx = (await auth.$context) as unknown as typeof authCtx;
    authCtx.password.hash.mockResolvedValue('hashed-password');
    authCtx.internalAdapter.createUser.mockResolvedValue({ id: 'new-user-1' });
    authCtx.internalAdapter.linkAccount.mockResolvedValue(undefined);
    authCtx.internalAdapter.deleteUser.mockResolvedValue(undefined);
    (auth.api.requestPasswordReset as unknown as jest.Mock).mockResolvedValue(
      undefined,
    );

    mailService = {
      sendHatAddedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: StaffPermissionsService, useValue: staffPermissions },
        { provide: MailService, useValue: mailService },
        { provide: InboxService, useValue: { notify: jest.fn() } },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── invitePlatformStaff ───────────────────────────────────────────────────

  describe('invitePlatformStaff', () => {
    it('throws ConflictException (409) when the email already holds a staff seat', async () => {
      prisma.user.findUnique.mockResolvedValue({
        staffMember: { id: 'sm-1', operatorId: null },
        operator: null,
      });

      await expect(
        service.invitePlatformStaff(
          { email: 'jane@islandtours.com', name: 'Jane' },
          makeActor(),
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.staffMember.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException (409) when the email belongs to an operator account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        staffMember: null,
        operator: { id: 'op-1' },
      });

      await expect(
        service.invitePlatformStaff(
          { email: 'owner@islandtours.com', name: 'Owner' },
          makeActor(),
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.staffMember.create).not.toHaveBeenCalled();
    });

    it('attaches the staff hat to an existing credentialed customer: ACTIVE seat, hat-added mail, role elevated', async () => {
      // First findUnique: same-hat pre-check (no staff row, no operator).
      // Second findUnique (inside provisionOrAttachAccount): the account row.
      prisma.user.findUnique
        .mockResolvedValueOnce({ staffMember: null, operator: null })
        .mockResolvedValueOnce({
          id: 'customer-1',
          role: Role.USER,
          hasPassword: true,
          isSystemAccount: false,
        });
      prisma.user.update.mockResolvedValue({ id: 'customer-1' });
      prisma.staffMember.create.mockResolvedValue(makeMemberRow());

      await service.invitePlatformStaff(
        { email: 'jane@islandtours.com', name: 'Jane' },
        makeActor(),
      );

      // Role elevated USER -> STAFF on the existing account.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'customer-1' },
          data: { role: Role.STAFF },
        }),
      );
      // Seat starts ACTIVE - the account already has a proven password.
      expect(prisma.staffMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'customer-1',
            status: StaffStatus.ACTIVE,
          }),
        }),
      );
      // No user was created, no set-password invite - notification only.
      expect(authCtx.internalAdapter.createUser).not.toHaveBeenCalled();
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(mailService.sendHatAddedEmail).toHaveBeenCalledWith(
        'jane@islandtours.com',
        expect.objectContaining({ variant: 'platform' }),
      );
      expect(staffPermissions.invalidate).toHaveBeenCalledWith('customer-1');
    });

    it('attach rollback restores the prior role and never deletes the pre-existing user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ staffMember: null, operator: null })
        .mockResolvedValueOnce({
          id: 'customer-1',
          role: Role.USER,
          hasPassword: true,
          isSystemAccount: false,
        });
      prisma.user.update.mockResolvedValue({ id: 'customer-1' });
      prisma.staffMember.create.mockRejectedValue(new Error('db unavailable'));
      prisma.staffMember.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.invitePlatformStaff(
          { email: 'jane@islandtours.com', name: 'Jane' },
          makeActor(),
        ),
      ).rejects.toThrow('db unavailable');

      expect(authCtx.internalAdapter.deleteUser).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'customer-1' },
          data: { role: Role.USER },
        }),
      );
    });

    it('rejects extraPermissions outside PLATFORM_STAFF_CEILING with a 400', async () => {
      await expect(
        service.invitePlatformStaff(
          {
            email: 'jane@islandtours.com',
            name: 'Jane',
            extraPermissions: [Permission.MANAGE_SYSTEM],
          },
          makeActor(),
        ),
      ).rejects.toThrow(BadRequestException);

      // Ceiling check runs before any DB work.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rolls back (deleteUser) when staffMember.create throws', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.staffMember.create.mockRejectedValue(new Error('db unavailable'));

      await expect(
        service.invitePlatformStaff(
          { email: 'jane@islandtours.com', name: 'Jane' },
          makeActor(),
        ),
      ).rejects.toThrow('db unavailable');

      expect(authCtx.internalAdapter.deleteUser).toHaveBeenCalledWith(
        'new-user-1',
      );
    });
  });

  // ── inviteTeamMember ──────────────────────────────────────────────────────

  describe('inviteTeamMember', () => {
    it('rejects with 400 when an ADMIN actor omits operatorId', async () => {
      await expect(
        service.inviteTeamMember(
          { email: 'jane@islandtours.com', name: 'Jane' },
          makeActor({ role: Role.ADMIN }),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('auto-resolves the operator for an owner actor with no operatorId given', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.staffMember.create.mockResolvedValue(
        makeMemberRow({ operatorId: 'op-1' }),
      );

      await service.inviteTeamMember(
        { email: 'jane@islandtours.com', name: 'Jane' },
        makeActor({ id: 'owner-1', role: Role.TOUR_OPERATOR }),
      );

      expect(prisma.operator.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'owner-1' } }),
      );
      expect(prisma.staffMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ operatorId: 'op-1' }),
        }),
      );
    });

    it('rejects with 403 when an owner passes a FOREIGN operatorId', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.inviteTeamMember(
          {
            email: 'jane@islandtours.com',
            name: 'Jane',
            operatorId: 'a-foreign-operator',
          },
          makeActor({ id: 'owner-1', role: Role.TOUR_OPERATOR }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.staffMember.create).not.toHaveBeenCalled();
    });

    it('rejects with 400 when the designation does not belong to the resolved operator scope', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.staffDesignation.findUnique.mockResolvedValue({
        id: 'designation-1',
        operatorId: 'a-different-operator',
      });

      await expect(
        service.inviteTeamMember(
          {
            email: 'jane@islandtours.com',
            name: 'Jane',
            operatorId: 'op-1',
            designationId: 'designation-1',
          },
          makeActor({ role: Role.ADMIN }),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.staffMember.create).not.toHaveBeenCalled();
    });
  });

  // ── Status updates (OWNER guard / self-change guard / suspend / reactivate) ─

  describe('status updates (updatePlatformStaffStatus / updateTeamMemberStatus)', () => {
    it('rejects with 403 when the target is an OWNER seat', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(
        makeMemberRow({ seatRole: StaffSeatRole.OWNER }),
      );

      await expect(
        service.updatePlatformStaffStatus(
          'member-1',
          { status: StaffStatus.SUSPENDED },
          makeActor({ id: 'admin-1' }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects with 400 when the actor tries to change their own status', async () => {
      prisma.staffMember.findUnique.mockResolvedValue(
        makeMemberRow({
          user: {
            id: 'actor-1',
            name: 'Jane',
            email: 'jane@islandtours.com',
            image: null,
            status: UserStatus.ACTIVE,
          },
        }),
      );

      await expect(
        service.updatePlatformStaffStatus(
          'member-1',
          { status: StaffStatus.SUSPENDED },
          makeActor({ id: 'actor-1' }),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('suspending sets the user to SUSPENDED, deletes sessions, and invalidates the permission cache', async () => {
      const row = makeMemberRow({ status: StaffStatus.ACTIVE });
      prisma.staffMember.findUnique.mockResolvedValue(row);
      prisma.staffMember.update.mockResolvedValue({
        ...row,
        status: StaffStatus.SUSPENDED,
      });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.updatePlatformStaffStatus(
        'member-1',
        { status: StaffStatus.SUSPENDED },
        makeActor({ id: 'admin-1' }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ status: UserStatus.SUSPENDED }),
        }),
      );
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(staffPermissions.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('reactivating an INVITED member sets ACTIVE, stamps activatedAt, and leaves sessions alone', async () => {
      const row = makeMemberRow({ status: StaffStatus.INVITED });
      prisma.staffMember.findUnique.mockResolvedValue(row);
      prisma.staffMember.update.mockResolvedValue({
        ...row,
        status: StaffStatus.ACTIVE,
      });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.updatePlatformStaffStatus(
        'member-1',
        { status: StaffStatus.ACTIVE },
        makeActor({ id: 'admin-1' }),
      );

      expect(prisma.staffMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activatedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UserStatus.ACTIVE }),
        }),
      );
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('applies the same rules via updateTeamMemberStatus for an operator-scoped seat', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.staffMember.findUnique.mockResolvedValue(
        makeMemberRow({ seatRole: StaffSeatRole.OWNER, operatorId: 'op-1' }),
      );

      await expect(
        service.updateTeamMemberStatus(
          'member-1',
          { status: StaffStatus.SUSPENDED },
          makeActor({ id: 'owner-1', role: Role.TOUR_OPERATOR }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── removeTeamMember ──────────────────────────────────────────────────────

  describe('removeTeamMember', () => {
    it('rejects with 403 when the target is an OWNER seat', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.staffMember.findUnique.mockResolvedValue(
        makeMemberRow({ seatRole: StaffSeatRole.OWNER, operatorId: 'op-1' }),
      );

      await expect(
        service.removeTeamMember(
          'member-1',
          makeActor({ id: 'owner-1', role: Role.TOUR_OPERATOR }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects with 400 when the actor tries to remove their own account', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.staffMember.findUnique.mockResolvedValue(
        makeMemberRow({
          operatorId: 'op-1',
          user: {
            id: 'owner-1',
            name: 'Owner',
            email: 'owner@islandtours.com',
            image: null,
            status: UserStatus.ACTIVE,
          },
        }),
      );

      await expect(
        service.removeTeamMember(
          'member-1',
          makeActor({ id: 'owner-1', role: Role.TOUR_OPERATOR }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Designations ──────────────────────────────────────────────────────────

  describe('designations', () => {
    describe('createPlatformDesignation', () => {
      it('throws ConflictException (409) when a designation with the same name already exists', async () => {
        prisma.staffDesignation.findFirst.mockResolvedValue({
          id: 'existing',
        });

        await expect(
          service.createPlatformDesignation(
            {
              name: 'Operations Manager',
              permissions: [Permission.VIEW_TRIPS],
            },
            makeActor(),
          ),
        ).rejects.toThrow(ConflictException);

        expect(prisma.staffDesignation.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException (400) when permissions are outside the platform ceiling', async () => {
        await expect(
          service.createPlatformDesignation(
            { name: 'Rogue', permissions: [Permission.MANAGE_STAFF] },
            makeActor(),
          ),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.staffDesignation.findFirst).not.toHaveBeenCalled();
      });

      it('falls back to a 409 on a P2002 unique-constraint race from a concurrent create', async () => {
        prisma.staffDesignation.findFirst.mockResolvedValue(null);
        prisma.staffDesignation.create.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'x',
          }),
        );

        await expect(
          service.createPlatformDesignation(
            {
              name: 'Operations Manager',
              permissions: [Permission.VIEW_TRIPS],
            },
            makeActor(),
          ),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('updatePlatformDesignation', () => {
      it('throws ForbiddenException (403) when renaming a system designation', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: true, name: 'Admin' }),
        );

        await expect(
          service.updatePlatformDesignation('designation-1', {
            name: 'New Name',
          }),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.staffDesignation.update).not.toHaveBeenCalled();
      });

      it('throws BadRequestException (400) when permissions are outside the ceiling', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: false }),
        );

        await expect(
          service.updatePlatformDesignation('designation-1', {
            permissions: [Permission.MANAGE_SYSTEM],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('invalidates the entire permission cache when permissions are edited', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: false }),
        );
        prisma.staffDesignation.update.mockResolvedValue(
          makeDesignationRow({ permissions: [Permission.VIEW_BOOKINGS] }),
        );

        await service.updatePlatformDesignation('designation-1', {
          permissions: [Permission.VIEW_BOOKINGS],
        });

        expect(staffPermissions.invalidateAll).toHaveBeenCalledTimes(1);
      });

      it('does not invalidate the cache for a name-only edit', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: false, name: 'Old Name' }),
        );
        prisma.staffDesignation.findFirst.mockResolvedValue(null);
        prisma.staffDesignation.update.mockResolvedValue(
          makeDesignationRow({ name: 'New Name' }),
        );

        await service.updatePlatformDesignation('designation-1', {
          name: 'New Name',
        });

        expect(staffPermissions.invalidateAll).not.toHaveBeenCalled();
      });
    });

    describe('deletePlatformDesignation', () => {
      it('throws ForbiddenException (403) when deleting a system designation', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: true, _count: { members: 0 } }),
        );

        await expect(
          service.deletePlatformDesignation('designation-1'),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.staffDesignation.delete).not.toHaveBeenCalled();
      });

      it('throws ConflictException (409) when members are still assigned to the designation', async () => {
        prisma.staffDesignation.findUnique.mockResolvedValue(
          makeDesignationRow({ isSystem: false, _count: { members: 3 } }),
        );

        await expect(
          service.deletePlatformDesignation('designation-1'),
        ).rejects.toThrow(ConflictException);

        expect(prisma.staffDesignation.delete).not.toHaveBeenCalled();
      });
    });
  });

  // ── getPermissionCatalog ──────────────────────────────────────────────────

  describe('getPermissionCatalog', () => {
    it('excludes MANAGE_OPERATOR_PAYMENTS and MANAGE_TEAM for the team scope', () => {
      const catalog = service.getPermissionCatalog('team');
      const keys = catalog.groups.flatMap((g) =>
        g.permissions.map((p) => p.key),
      );

      expect(keys).not.toContain(Permission.MANAGE_OPERATOR_PAYMENTS);
      expect(keys).not.toContain(Permission.MANAGE_TEAM);
      // Sanity: the team ceiling still lets ordinary grantable permissions through.
      expect(keys).toContain(Permission.VIEW_TRIPS);
    });

    it('excludes MANAGE_SYSTEM and MANAGE_STAFF for the platform scope', () => {
      const catalog = service.getPermissionCatalog('platform');
      const keys = catalog.groups.flatMap((g) =>
        g.permissions.map((p) => p.key),
      );

      expect(keys).not.toContain(Permission.MANAGE_SYSTEM);
      expect(keys).not.toContain(Permission.MANAGE_STAFF);
      expect(keys).toContain(Permission.VIEW_TRIPS);
    });

    it('platform scope excludes identity mutations and payout config (security-review hardening)', () => {
      const catalog = service.getPermissionCatalog('platform');
      const keys = catalog.groups.flatMap((g) =>
        g.permissions.map((p) => p.key),
      );

      // Role flips / email changes are an escalation surface; payout config
      // is owner-only in the operators service and must not be offered.
      expect(keys).not.toContain(Permission.MANAGE_USERS);
      expect(keys).not.toContain(Permission.CREATE_USER);
      expect(keys).not.toContain(Permission.UPDATE_USER);
      expect(keys).not.toContain(Permission.DELETE_USER);
      expect(keys).not.toContain(Permission.MANAGE_OPERATOR_PAYMENTS);
      // Read-only user visibility stays grantable.
      expect(keys).toContain(Permission.VIEW_USERS);
    });
  });

  describe('system administrator visibility', () => {
    const adminUser = {
      id: 'admin-1',
      name: 'System Admin',
      email: 'admin@islandtours.test',
      image: null,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      sessions: [{ createdAt: new Date('2026-07-19T10:00:00Z') }],
    };

    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([adminUser]);
      prisma.staffMember.count.mockResolvedValue(0);
      prisma.staffMember.findMany.mockResolvedValue([]);
    });

    it('lists the platform admin even though it has no staff_members row', async () => {
      const res = await service.listPlatformStaff({});

      expect(res.total).toBe(1);
      expect(res.data).toHaveLength(1);
      expect(res.data[0]).toMatchObject({
        id: 'admin-1',
        isSystemAdmin: true,
        operatorId: null,
        status: StaffStatus.ACTIVE,
        designation: null,
      });
      // Real last-login comes from the newest session, not a placeholder.
      expect(res.data[0].lastLoginAt).toEqual(new Date('2026-07-19T10:00:00Z'));
      // Full admin permission set, so the UI can render "Full access".
      expect(res.data[0].effectivePermissions).toContain(
        Permission.MANAGE_SYSTEM,
      );
    });

    it('sorts the admin ahead of real staff and counts it in the total', async () => {
      prisma.staffMember.count.mockResolvedValue(1);
      prisma.staffMember.findMany.mockResolvedValue([
        {
          id: 'staff-1',
          operatorId: null,
          seatRole: StaffSeatRole.STAFF,
          status: StaffStatus.ACTIVE,
          extraPermissions: [],
          revokedPermissions: [],
          invitedAt: new Date(),
          activatedAt: new Date(),
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'u-staff',
            name: 'Staffer',
            email: 's@x.test',
            image: null,
            status: UserStatus.ACTIVE,
          },
          designation: null,
          invitedBy: null,
        },
      ]);

      const res = await service.listPlatformStaff({});

      expect(res.total).toBe(2);
      expect(res.data.map((m) => m.id)).toEqual(['admin-1', 'staff-1']);
      expect(res.data[1].isSystemAdmin).toBe(false);
    });

    it('hides the admin when filtering for a status it can never hold', async () => {
      const res = await service.listPlatformStaff({
        status: StaffStatus.SUSPENDED,
      });

      // An admin is always active and never invited, so a SUSPENDED filter
      // must not surface it as a phantom match.
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(res.data).toHaveLength(0);
      expect(res.total).toBe(0);
    });

    it.each([
      [
        'removePlatformStaff',
        () => service.removePlatformStaff('admin-1', makeActor()),
      ],
      [
        'updatePlatformStaffStatus',
        () =>
          service.updatePlatformStaffStatus(
            'admin-1',
            { status: StaffStatus.SUSPENDED },
            makeActor(),
          ),
      ],
      [
        'updatePlatformStaff',
        () => service.updatePlatformStaff('admin-1', { extraPermissions: [] }),
      ],
      ['resendPlatformInvite', () => service.resendPlatformInvite('admin-1')],
    ])('rejects %s on the system administrator', async (_name, call) => {
      prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN });

      await expect(call()).rejects.toThrow(ForbiddenException);
      // The guard must fire BEFORE the staff lookup, so the refusal reads as
      // "not allowed" rather than 404 "not found".
      expect(prisma.staffMember.findUnique).not.toHaveBeenCalled();
    });
  });
});
