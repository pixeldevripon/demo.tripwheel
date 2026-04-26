/**
 * Unit tests for UserService.
 * PrismaService is fully mocked — no real database connection is made.
 * Tests cover every public method including all error paths and the role/status
 * guard logic (self-modification checks, admin-protection checks).
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { UserService } from './user.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  OperatorQueryDto,
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';

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
  };
}

/** Minimal user shape returned by Prisma `select` projections used in the service. */
function makeUserRecord(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
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
function makeUserSummary(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  updatedAt: Date;
}> = {}) {
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

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
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
      expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 20 }),
      );
    });

    it('passes role filter to where clause when role is provided', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = { role: Role.TOUR_OPERATOR, page: 1, limit: 20 };
      await service.getAllUsers(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.TOUR_OPERATOR },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: Role.TOUR_OPERATOR } }),
      );
    });

    it('passes status filter to where clause when status is provided', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: UserQueryDto = { status: UserStatus.SUSPENDED, page: 1, limit: 20 };
      await service.getAllUsers(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { status: UserStatus.SUSPENDED },
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
        where: { role: Role.USER, status: UserStatus.INACTIVE },
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

  describe('getAllOperators', () => {
    it('always includes role=TOUR_OPERATOR in the where clause', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: OperatorQueryDto = { page: 1, limit: 20 };
      await service.getAllOperators(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.TOUR_OPERATOR },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: Role.TOUR_OPERATOR } }),
      );
    });

    it('adds status filter on top of the forced role filter', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const query: OperatorQueryDto = { status: UserStatus.ACTIVE, page: 1, limit: 20 };
      await service.getAllOperators(query);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.TOUR_OPERATOR, status: UserStatus.ACTIVE },
      });
    });

    it('returns paginated shape with correct metadata', async () => {
      const operators = [makeUserRecord({ role: Role.TOUR_OPERATOR })];
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue(operators);

      const result = await service.getAllOperators({ page: 1, limit: 20 });

      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: operators });
    });

    it('calculates skip correctly on page 2 with limit 5', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getAllOperators({ page: 2, limit: 5 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

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
      const updated = makeUserRecord({ name: 'New Name', image: 'https://cdn.example.com/img.jpg' });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const dto: UpdateUserProfileDto = { name: 'New Name', image: 'https://cdn.example.com/img.jpg' };
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
      const updated = makeUserRecord({ id: 'user-2', name: 'Bob', email: 'bob@example.com' });
      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const dto: UpdateUserByAdminDto = { name: 'Bob', email: 'bob@example.com' };
      const result = await service.updateUserByAdmin('user-2', dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-2' },
          data: dto,
        }),
      );
      expect(result).toEqual(updated);
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
        service.updateUserRole('user-1', dto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target is ADMIN and new role is not ADMIN', async () => {
      const adminTarget = makeUserRecord({ id: 'admin-1', role: Role.ADMIN });
      prisma.user.findUnique.mockResolvedValue(adminTarget);

      const dto: UpdateUserRoleDto = { role: Role.USER };

      await expect(
        service.updateUserRole('admin-1', dto, 'requester-2'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when trying to assign the ADMIN role', async () => {
      // Target is a regular user — the blocked case is the new role being ADMIN
      const regularUser = makeUserRecord({ id: 'user-3', role: Role.USER });
      prisma.user.findUnique.mockResolvedValue(regularUser);

      const dto: UpdateUserRoleDto = { role: Role.ADMIN };

      await expect(
        service.updateUserRole('user-3', dto, 'requester-2'),
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
      const result = await service.updateUserRole('user-5', dto, 'admin-1');

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
        service.updateUserRole('nonexistent', dto, 'admin-1'),
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

      await expect(service.deleteUser('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
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
});
