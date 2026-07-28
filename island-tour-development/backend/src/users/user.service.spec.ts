/**
 * Unit tests for UserService.
 * PrismaService is fully mocked - no real database connection is made.
 * Tests cover every public method including all error paths and the role/status
 * guard logic (self-modification checks, admin-protection checks).
 */

// Mock the Better Auth instance - the real module pulls in the ESM-only
// `better-auth` package, which ts-jest does not transform (node_modules).
// UserService only ever calls `auth.api.setPassword`.
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    api: { setPassword: jest.fn(), verifyPassword: jest.fn() },
    // `auth.$context` is a promise in Better Auth - the password-change flow
    // awaits it for the hasher and the internal adapter.
    $context: Promise.resolve({
      password: { hash: jest.fn().mockResolvedValue('hashed:new') },
      internalAdapter: {
        updatePassword: jest.fn(),
        deleteSessions: jest.fn(),
      },
    }),
  },
}));

import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import {
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { MailService } from '@/mail/mail.service';
import { TargetRateLimiter } from '@/bookings/lookup-rate-limiter';
import { auth } from '@/auth/auth.instance';
import { UserService } from './user.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockPrismaService() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Touched by syncStatusSideEffects (suspension kills sessions + syncs
    // any staff_members row).
    session: { deleteMany: jest.fn() },
    staffMember: { updateMany: jest.fn() },
    passwordChangeRequest: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

/** Minimal user shape returned by Prisma `select` projections used in the service. */
function makeUserRecord(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: Role;
    status: UserStatus;
    isSystemAccount: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    emailVerified: true,
    image: null,
    role: Role.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

/** Slim shape returned by updateUserRole / updateUserStatus / deleteUser. */
function makeUserSummary(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  // Effective-permission resolver (staff/team engine) - not under test here.
  const staffPermissions = {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateAll: jest.fn(),
  };
  const mail = {
    sendPasswordChangeConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  };
  const targetLimiter = { consume: jest.fn() };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: StaffPermissionsService, useValue: staffPermissions },
        { provide: MailService, useValue: mail },
        { provide: TargetRateLimiter, useValue: targetLimiter },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  // ── getAllUsers ──────────────────────────────────────────────────────────────

  describe('getAllUsers', () => {
    it('returns paginated results with no filters applied', async () => {
      const users = [makeUserRecord()];
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue(users);

      const query: UserQueryDto = { page: 1, limit: 20 };
      const result = await service.getAllUsers(query);

      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: users });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { isSystemAccount: false },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isSystemAccount: false },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('passes role filter to where clause when role is provided', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = {
        role: Role.TOUR_OPERATOR,
        page: 1,
        limit: 20,
      };
      await service.getAllUsers(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.TOUR_OPERATOR, isSystemAccount: false },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: Role.TOUR_OPERATOR, isSystemAccount: false },
        }),
      );
    });

    it('passes status filter to where clause when status is provided', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = {
        status: UserStatus.SUSPENDED,
        page: 1,
        limit: 20,
      };
      await service.getAllUsers(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { status: UserStatus.SUSPENDED, isSystemAccount: false },
      });
    });

    it('combines role and status filters', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = {
        role: Role.USER,
        status: UserStatus.INACTIVE,
        page: 1,
        limit: 20,
      };
      await service.getAllUsers(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          role: Role.USER,
          status: UserStatus.INACTIVE,
          isSystemAccount: false,
        },
      });
    });

    it('calculates skip correctly for page 2 with limit 10', async () => {
      prisma.user.count.mockResolvedValue(25);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = { page: 2, limit: 10 };
      const result = await service.getAllUsers(query);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('calculates skip correctly for page 3 with limit 5', async () => {
      prisma.user.count.mockResolvedValue(20);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = { page: 3, limit: 5 };
      await service.getAllUsers(query);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('uses default page=1 and limit=20 when not provided', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = {};
      await service.getAllUsers(query);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ── getAllOperators ──────────────────────────────────────────────────────────

  // ── getUserById ──────────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      const user = makeUserRecord({ id: 'user-abc' });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById('user-abc');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-abc' } }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes the user id in the NotFoundException message', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('missing-id')).rejects.toThrow(
        'missing-id',
      );
    });
  });

  // ── getCurrentUser ───────────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('delegates to getUserById with the provided userId', async () => {
      const user = makeUserRecord({ id: 'user-xyz' });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getCurrentUser('user-xyz');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-xyz' } }),
      );
    });

    it('propagates NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateUserProfile ────────────────────────────────────────────────────────

  describe('updateUserProfile', () => {
    it('verifies user exists before updating', async () => {
      const existing = makeUserRecord({ id: 'user-1' });
      const updated = makeUserRecord({ id: 'user-1', name: 'Alice Updated' });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const dto: UpdateUserProfileDto = { name: 'Alice Updated' };
      await service.updateUserProfile('user-1', dto);

      // getUserById must be called first
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('calls prisma.user.update with the provided dto data', async () => {
      const existing = makeUserRecord();
      const updated = makeUserRecord({
        name: 'New Name',
        image: 'https://cdn.example.com/img.jpg',
      });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const dto: UpdateUserProfileDto = {
        name: 'New Name',
        image: 'https://cdn.example.com/img.jpg',
      };
      const result = await service.updateUserProfile('user-1', dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: dto,
        }),
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const dto: UpdateUserProfileDto = { name: 'Ghost' };
      await expect(service.updateUserProfile('missing', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── updateUserByAdmin ────────────────────────────────────────────────────────

  describe('updateUserByAdmin', () => {
    it('verifies user exists before updating', async () => {
      const existing = makeUserRecord({ id: 'user-2' });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(existing);

      await service.updateUserByAdmin('user-2', { name: 'Bob' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-2' } }),
      );
    });

    it('calls prisma.user.update with the admin dto', async () => {
      const existing = makeUserRecord({ id: 'user-2' });
      const updated = makeUserRecord({
        id: 'user-2',
        name: 'Bob',
      });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const dto: UpdateUserByAdminDto = { name: 'Bob' };
      const result = await service.updateUserByAdmin('user-2', dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-2' },
          data: dto,
        }),
      );
      expect(result).toEqual(updated);
    });

    it('refuses to edit an ADMIN account', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUserRecord({ id: 'admin-2', role: Role.ADMIN }),
      );

      await expect(
        service.updateUserByAdmin('admin-2', { name: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('404s on a hidden system account before any update runs', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUserRecord({
          id: 'sys-1',
          role: Role.ADMIN,
          isSystemAccount: true,
        }),
      );

      await expect(
        service.updateUserByAdmin('sys-1', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserByAdmin('missing', { name: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── updateUserRole ───────────────────────────────────────────────────────────

  describe('updateUserRole', () => {
    it('throws BadRequestException when id equals requestingUserId', async () => {
      const dto: UpdateUserRoleDto = { role: Role.USER };

      await expect(
        service.updateUserRole('user-1', dto, {
          id: 'user-1',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is not a real ADMIN (delegated MANAGE_USERS)', async () => {
      const dto: UpdateUserRoleDto = { role: Role.EDITOR };

      await expect(
        service.updateUserRole('user-9', dto, {
          id: 'staff-1',
          role: Role.STAFF,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target is ADMIN and new role is not ADMIN', async () => {
      const adminTarget = makeUserRecord({ id: 'admin-1', role: Role.ADMIN });
      prisma.user.findUnique.mockResolvedValue(adminTarget);

      const dto: UpdateUserRoleDto = { role: Role.USER };

      await expect(
        service.updateUserRole('admin-1', dto, {
          id: 'requester-2',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when trying to assign the ADMIN role', async () => {
      // Target is a regular user - the blocked case is the new role being ADMIN
      const regularUser = makeUserRecord({ id: 'user-3', role: Role.USER });
      prisma.user.findUnique.mockResolvedValue(regularUser);

      const dto: UpdateUserRoleDto = { role: Role.ADMIN };

      await expect(
        service.updateUserRole('user-3', dto, {
          id: 'requester-2',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the role and returns the updated user on happy path', async () => {
      const target = makeUserRecord({ id: 'user-5', role: Role.USER });
      const updatedSummary = makeUserSummary({
        id: 'user-5',
        role: Role.TOUR_OPERATOR,
      });
      prisma.user.findUnique.mockResolvedValue(target);
      prisma.user.update.mockResolvedValue(updatedSummary);

      const dto: UpdateUserRoleDto = { role: Role.TOUR_OPERATOR };
      const result = await service.updateUserRole('user-5', dto, {
        id: 'admin-1',
        role: Role.ADMIN,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-5' },
          data: { role: Role.TOUR_OPERATOR },
        }),
      );
      expect(result).toEqual(updatedSummary);
    });

    it('throws NotFoundException when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const dto: UpdateUserRoleDto = { role: Role.USER };

      await expect(
        service.updateUserRole('nonexistent', dto, {
          id: 'admin-1',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateUserStatus ─────────────────────────────────────────────────────────

  describe('updateUserStatus', () => {
    it('throws BadRequestException when id equals requestingUserId', async () => {
      const dto: UpdateUserStatusDto = { status: UserStatus.SUSPENDED };

      await expect(
        service.updateUserStatus('user-1', dto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target is an ADMIN account', async () => {
      const adminTarget = makeUserRecord({ id: 'admin-2', role: Role.ADMIN });
      prisma.user.findUnique.mockResolvedValue(adminTarget);

      const dto: UpdateUserStatusDto = { status: UserStatus.SUSPENDED };

      await expect(
        service.updateUserStatus('admin-2', dto, 'requester-3'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates status and returns updated user on happy path', async () => {
      const target = makeUserRecord({ id: 'user-4', role: Role.USER });
      const updatedSummary = makeUserSummary({
        id: 'user-4',
        status: UserStatus.SUSPENDED,
      });
      prisma.user.findUnique.mockResolvedValue(target);
      prisma.user.update.mockResolvedValue(updatedSummary);

      const dto: UpdateUserStatusDto = { status: UserStatus.SUSPENDED };
      const result = await service.updateUserStatus('user-4', dto, 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-4' },
          data: { status: UserStatus.SUSPENDED },
        }),
      );
      expect(result).toEqual(updatedSummary);
    });

    it('throws NotFoundException when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const dto: UpdateUserStatusDto = { status: UserStatus.INACTIVE };

      await expect(
        service.updateUserStatus('nonexistent', dto, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteUser ───────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('throws BadRequestException when id equals requestingUserId', async () => {
      await expect(service.deleteUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target is an ADMIN account', async () => {
      const adminTarget = makeUserRecord({ id: 'admin-3', role: Role.ADMIN });
      prisma.user.findUnique.mockResolvedValue(adminTarget);

      await expect(
        service.deleteUser('admin-3', 'requester-5'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes the user and returns success message on happy path', async () => {
      const target = makeUserRecord({ id: 'user-6', role: Role.USER });
      prisma.user.findUnique.mockResolvedValue(target);
      prisma.user.delete.mockResolvedValue(target);

      const result = await service.deleteUser('user-6', 'admin-1');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-6' },
      });
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('throws NotFoundException when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteUser('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('verifies the user first before attempting deletion', async () => {
      const target = makeUserRecord({ id: 'user-7', role: Role.TOUR_OPERATOR });
      prisma.user.findUnique.mockResolvedValue(target);
      prisma.user.delete.mockResolvedValue(target);

      await service.deleteUser('user-7', 'admin-1');

      // findUnique (via getUserById) must be called before delete
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-7' } }),
      );
    });
  });

  // ── Password change: verify the password, then confirm from the mailbox ────
  describe('password change', () => {
    const actor = { id: 'user-1', email: 'op@example.test', name: 'Op' };
    const dto = {
      currentPassword: 'CurrentPassword123!',
      newPassword: 'BrandNewPassword123!',
    };

    beforeEach(() => {
      (auth.api.verifyPassword as unknown as jest.Mock).mockResolvedValue({
        status: true,
      });
      prisma.passwordChangeRequest.upsert.mockResolvedValue({});
    });

    it('emails a confirm link and does NOT touch the password yet', async () => {
      const res = await service.requestPasswordChange(
        dto,
        actor,
        'ck=1',
        '1.2.3.4',
      );

      expect(res).toEqual({ sent: true });
      // The parked row stores a HASH, never the plaintext.
      const row = prisma.passwordChangeRequest.upsert.mock.calls[0][0];
      expect(row.create.newPasswordHash).toBe('hashed:new');
      expect(JSON.stringify(row)).not.toContain(dto.newPassword);
      // The raw token is only in the emailed URL, never in the row.
      const [, confirmUrl] =
        mail.sendPasswordChangeConfirmationEmail.mock.calls[0];
      const token = new URL(confirmUrl).searchParams.get('token');
      expect(token).toBeTruthy();
      expect(row.create.tokenHash).not.toBe(token);
      // Nothing on the credential account changed at request time.
      const ctx = await auth.$context;
      expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
    });

    it('401s on a wrong current password, sends nothing, spends no budget', async () => {
      (auth.api.verifyPassword as unknown as jest.Mock).mockRejectedValue({
        body: { code: 'INVALID_PASSWORD' },
      });

      await expect(
        service.requestPasswordChange(dto, actor, 'ck=1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mail.sendPasswordChangeConfirmationEmail).not.toHaveBeenCalled();
      expect(prisma.passwordChangeRequest.upsert).not.toHaveBeenCalled();
      // The guess IS counted (a stolen session must not get an unbounded
      // password oracle), but on the attempt bucket only - never the
      // success/email bucket, or wrong guesses would lock the real owner out
      // of changing their own password.
      const buckets = targetLimiter.consume.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(buckets).toEqual(['password-change-attempt']);
    });

    it('discards the parked change when the confirmation email fails', async () => {
      mail.sendPasswordChangeConfirmationEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );

      await expect(
        service.requestPasswordChange(dto, actor, 'ck=1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // The token only existed in the undelivered email - leaving the row
      // would strand an uncompletable pending change on the account.
      expect(prisma.passwordChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('refuses a new password identical to the current one', async () => {
      await expect(
        service.requestPasswordChange(
          {
            currentPassword: 'Same-Password-123',
            newPassword: 'Same-Password-123',
          },
          actor,
          'ck=1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auth.api.verifyPassword).not.toHaveBeenCalled();
    });

    it('confirm applies the parked hash, revokes sessions and stamps the user', async () => {
      prisma.passwordChangeRequest.findUnique.mockResolvedValue({
        id: 'pcr-1',
        userId: 'user-1',
        newPasswordHash: 'hashed:new',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const res = await service.confirmPasswordChange({ token: 'raw-token' });

      expect(res).toEqual({ changed: true });
      const ctx = await auth.$context;
      expect(ctx.internalAdapter.updatePassword).toHaveBeenCalledWith(
        'user-1',
        'hashed:new',
      );
      expect(ctx.internalAdapter.deleteSessions).toHaveBeenCalledWith('user-1');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { hasPassword: true, passwordChangedAt: expect.any(Date) },
        }),
      );
      // The row is consumed, so the link cannot be replayed.
      expect(prisma.passwordChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { id: 'pcr-1' },
      });
    });

    it('looks the token up by HASH, never by the raw value', async () => {
      prisma.passwordChangeRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.confirmPasswordChange({ token: 'raw-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const where = prisma.passwordChangeRequest.findUnique.mock.calls[0][0]
        .where as { tokenHash: string };
      expect(where.tokenHash).not.toBe('raw-token');
      expect(where.tokenHash).toHaveLength(64);
    });

    it('rejects an expired link and clears it', async () => {
      prisma.passwordChangeRequest.findUnique.mockResolvedValue({
        id: 'pcr-1',
        userId: 'user-1',
        newPasswordHash: 'hashed:new',
        expiresAt: new Date(Date.now() - 1),
      });

      await expect(
        service.confirmPasswordChange({ token: 'raw-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const ctx = await auth.$context;
      expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
      expect(prisma.passwordChangeRequest.deleteMany).toHaveBeenCalled();
    });

    it('a lost race on the single-use row applies nothing', async () => {
      prisma.passwordChangeRequest.findUnique.mockResolvedValue({
        id: 'pcr-1',
        userId: 'user-1',
        newPasswordHash: 'hashed:new',
        expiresAt: new Date(Date.now() + 60_000),
      });
      // The other click consumed the row first.
      prisma.passwordChangeRequest.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmPasswordChange({ token: 'raw-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const ctx = await auth.$context;
      expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
    });
  });
});
